import test from 'node:test'
import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { signArticleCatalogRequest } from '../lib/article-catalog-auth.js'
import { localRadarDatabaseUrl } from '../market-radar/worker/database-pool.mjs'
import { qiuMarketEnabled } from '../market-radar/worker/local-policy.mjs'
import { createHmacVerifier } from '../ops/local-backend/auth.mjs'
import { createOutboxRepository, createPublicRepository } from '../ops/local-backend/repository.mjs'
import { createRadarHandler, radarPoolOptions, RADAR_BIND_HOST } from '../ops/local-backend/server.mjs'
import { runDigestCatchup } from '../ops/local-backend/digest-catchup.mjs'
import { writeDigestHandoff } from '../ops/local-backend/digest-handoff.mjs'
import { rotateLogs } from '../ops/local-backend/rotate-logs.mjs'
import { cleanupTestProcesses } from '../ops/local-backend/cleanup-test-processes.mjs'
import { renderInstall } from '../ops/local-backend/render-install.mjs'
import { publishLocalGitSnapshots } from '../ops/local-backend/publish-git-snapshots.mjs'
import { materializeRadarPublication } from './radar-publication-materializer.mjs'

const root=new URL('../',import.meta.url)
const read=path=>readFile(new URL(path,root),'utf8')
const publicKey={id:'vercel-preview',secret:'p'.repeat(48)}
const internalKey={id:'hermes-local',secret:'i'.repeat(48)}

async function invoke(scope,key,query,{target='/healthz',method='GET',body='',headers}){
  const verify=createHmacVerifier(scope,JSON.stringify({[key.id]:key.secret}))
  const result={status:null,body:null,headers:new Map()}
  const req={method,url:target,headers:headers||{},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(body)}}
  const res={setHeader:(name,value)=>result.headers.set(name.toLowerCase(),String(value)),end:value=>{result.body=JSON.parse(value)},set statusCode(value){result.status=value},get statusCode(){return result.status}}
  await createRadarHandler({scope,verify,query})(req,res);return result
}

function signed(key,target,method='GET',body=''){return signArticleCatalogRequest({secret:key.secret,keyId:key.id,target,method,body,nonce:randomBytes(16).toString('hex'),timestamp:Date.now()})}

test('public and Hermes APIs are separate loopback HMAC allowlists with replay protection',async()=>{
  const statements=[];const query=async sql=>{statements.push(sql);return sql.includes('publication_snapshots')?[{snapshot_id:'market-1',as_of:new Date()}]:[{latest_event_at:null,event_count_24h:0,p0_count_24h:0,p1_count_24h:0}]}
  const verify=createHmacVerifier('public',JSON.stringify({[publicKey.id]:publicKey.secret}))
  const handler=createRadarHandler({scope:'public',verify,query})
  async function call(options){const result={status:null,body:null,headers:new Map()};const body=options.body||'';const req={method:options.method||'GET',url:options.target,headers:options.headers||{},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){if(body)yield Buffer.from(body)}};const res={setHeader:(n,v)=>result.headers.set(n.toLowerCase(),String(v)),end:v=>{result.body=JSON.parse(v)},set statusCode(v){result.status=v},get statusCode(){return result.status}};await handler(req,res);return result}
  const target='/healthz';const headers=signed(publicKey,target)
  const health=await call({target,headers});assert.equal(health.status,200);assert.equal(health.body.database,'ready');assert.ok(statements.includes('select 1 as ready'));assert.equal((await call({target,headers})).status,409);assert.equal((await call({target})).status,401)
  assert.equal((await call({target,headers:signed(publicKey,target,'GET','tampered'),body:''})).status,401)
  assert.equal((await call({target,headers:signArticleCatalogRequest({secret:publicKey.secret,keyId:publicKey.id,target,timestamp:Date.now()-120_000})})).status,401)
  const internalTarget='/v1/internal/market-radar/outbox/claim';assert.equal((await call({target:internalTarget,method:'POST',body:'{}',headers:signed(publicKey,internalTarget,'POST','{}')})).status,404)
  assert.equal((await invoke('internal',internalKey,async()=>[],{target:'/v1/market-radar/summary',headers:signed(internalKey,'/v1/market-radar/summary')})).status,404)
  assert.equal(RADAR_BIND_HOST,'127.0.0.1')
  assert.deepEqual(radarPoolOptions('public','socket-url'),{connectionString:'socket-url',max:2,idleTimeoutMillis:30_000,connectionTimeoutMillis:5_000,application_name:'xiuqiu-radar-public'})
  assert.deepEqual(radarPoolOptions('internal','socket-url'),{connectionString:'socket-url',max:2,idleTimeoutMillis:30_000,connectionTimeoutMillis:5_000,application_name:'xiuqiu-radar-internal'})
})

test('local database URL is exactly xiuqiu_radar on an absolute Unix socket',()=>{
  const valid='postgresql://xiuqiu_radar_app@localhost/xiuqiu_radar?host=%2Fprivate%2Ftmp%2Fradar-socket&port=55432'
  assert.equal(localRadarDatabaseUrl(valid),valid)
  for(const value of ['postgresql://u@127.0.0.1/xiuqiu_radar','postgresql://u@/xiuqiu_content?host=%2Ftmp','postgresql://u@/xiuqiu_radar?host=relative']) assert.throws(()=>localRadarDatabaseUrl(value))
})

test('local mode forbids Qiu Market while existing non-local default remains enabled',()=>{
  assert.equal(qiuMarketEnabled({}),true)
  assert.equal(qiuMarketEnabled({RADAR_DISABLE_QIU_MARKET:'true'}),false)
  assert.equal(qiuMarketEnabled({RADAR_LOCAL_BACKEND:'true'}),false)
  assert.throws(()=>qiuMarketEnabled({RADAR_LOCAL_BACKEND:'true',RADAR_ENABLE_QIU_MARKET:'true'}),/forbidden/)
  return read('market-radar/worker/run.mjs').then(source=>assert.ok(source.indexOf('const useQiuMarket = qiuMarketEnabled(env)')<source.indexOf('async function collectSource')))
})

test('summary freshness derives from the latest published item and reports delay honestly',async()=>{
  const recent=new Date(Date.now()-20*60_000);const stale=new Date(Date.now()-3*60*60_000);let latest=recent
  const query=async sql=>sql.includes("radar_kind = 'market'")?[{snapshot_id:'m1',as_of:recent}]:sql.includes('max(occurred_at)')?[{latest_event_at:latest,event_count_24h:1,p0_count_24h:0,p1_count_24h:1}]:[]
  const repo=createPublicRepository(query);const healthy=await repo.marketSummary();assert.equal(healthy.status,'healthy');assert.equal(healthy.isDelayed,false);assert.ok(healthy.freshnessMinutes>=19)
  latest=stale;const delayed=await repo.marketSummary();assert.equal(delayed.status,'degraded');assert.equal(delayed.isDelayed,true);assert.match(delayed.message,/超过 90 分钟/)
})

test('detail queries require published research snapshots and ACK atomically logs receipts',async()=>{
  const statements=[]
  const query=async(sql)=>{statements.push(sql);if(sql.includes('publication_snapshots')&&sql.includes("radar_kind = 'market'"))return[{snapshot_id:'m1',as_of:new Date()}];if(sql.includes('public_events'))return[];if(sql.startsWith('with updated as'))return[{id:'o1',attempts:1,status:'sent'}];return[]}
  const publicRepo=createPublicRepository(query);await publicRepo.marketEvent('event')
  const outbox=createOutboxRepository(query);await outbox.ack('market',{id:'o1',leaseToken:'l1',success:true,providerMessageId:'provider-1'})
  assert.match(statements.find(value=>value.includes('public_events')),/snapshot_id=\$2/)
  const ack=statements.find(value=>value.startsWith('with updated as'))
  assert.match(ack,/insert into market_radar\.delivery_logs/);assert.match(ack,/provider_message_id/);assert.match(ack,/case when \$3 then 'sent' else 'failed'/)
  statements.length=0;await outbox.claim('market',{kinds:['p0','daily']});const claim=statements[0]
  assert.match(claim,/kind<>'test'/);assert.match(claim,/publication_snapshots/);assert.match(claim,/payload::text !~\*/);assert.match(claim,/case kind when 'p0' then 0/)
})

test('Market upstream failure is explicit degraded no-store; Learning v2 page stays Git-static',async()=>{
  const [summary,digests,handler,upstream,page]=await Promise.all([read('api/market-radar/summary.ts'),read('api/market-radar/digests.ts'),read('lib/market-radar/events-handler.ts'),read('lib/radar-upstream.ts'),read('src/pages/RadarPage.vue')])
  for(const source of [summary,digests,handler]){assert.match(source,/status: 'degraded'/);assert.match(source,/Cache-Control', 'no-store'/)}
  assert.match(upstream,/AbortController/);assert.match(upstream,/redirect:'error'/);assert.match(upstream,/parsed\.protocol !== 'https:'/)
  assert.doesNotMatch(page,/fetch\(|parseLearningTimelineList|RADAR_PUBLIC_API/);assert.match(page,/latestRadars, radarIndex/)
  const externalSources=await Promise.all(['api/market-radar/summary.ts','api/market-radar/events.ts','api/market-radar/digests.ts','api/market-radar/events/[id].ts','api/learning-radar.ts'].map(read))
  for(const source of externalSources)assert.doesNotMatch(source,/market-radar\/repository|learning-radar\/repository|getMarketRadarDb|MARKET_RADAR_DATABASE_URL/)
  const writes=await Promise.all(['api/market-radar/feedback.ts','api/market-radar/outbox/claim.ts','api/market-radar/outbox/ack.ts','api/radar/outbox/claim.ts','api/radar/outbox/ack.ts'].map(read))
  for(const source of writes){assert.doesNotMatch(source,/repository|getMarketRadarDb|MARKET_RADAR_DATABASE_URL/);assert.match(source,/preparePrivateResponse/)}
})

test('Hermes validates exact internal origin, clean page origin and safe route roots',async()=>{
  const python=process.env.PYTHON||'python3'
  const common=new URL('../ops/hermes/market-radar-weixin/common.py',import.meta.url).pathname
  const script=`import importlib.util,sys,types\nm=types.ModuleType('hermes_cli.config');m.cfg_get=lambda *a,**k:k.get('default');m.load_config=lambda:{};sys.modules['hermes_cli']=types.ModuleType('hermes_cli');sys.modules['hermes_cli.config']=m\ns=importlib.util.spec_from_file_location('c',${JSON.stringify(common)});c=importlib.util.module_from_spec(s);sys.modules['c']=c;s.loader.exec_module(c)\nvalid=[('http://127.0.0.1:4321','https://xiuqiu.com')]\ninvalid=[('https://127.0.0.1:4321','https://xiuqiu.com'),('http://127.0.0.1:4320','https://xiuqiu.com'),('http://127.0.0.1:4321/prefix','https://xiuqiu.com'),('http://u@127.0.0.1:4321','https://xiuqiu.com'),('http://127.0.0.1:4321','http://xiuqiu.com'),('http://127.0.0.1:4321','https://u@xiuqiu.com'),('http://127.0.0.1:4321','https://xiuqiu.com?q=1')]\n[c.validate_runtime_origins(*x) for x in valid]\nfor x in invalid:\n try:c.validate_runtime_origins(*x);raise AssertionError(x)\n except RuntimeError:pass\np=c.normalized_payload({'kind':'daily','payload':{'date':'2026-08-12'}},c.RadarSpec('learning','c','a','h','/radar','t','f',('daily',),('p',)));assert p['pageUrl']=='/radar/2026-08-12'\ntry:c.safe_page_url({'pageUrl':'/radar-evil'},'https://xiuqiu.com','/radar');raise AssertionError('prefix')\nexcept c.DeliveryBlocked:pass\nprint('ok')`
  const result=spawnSync(python,['-c',script],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'ok')
})

test('schedules, named tunnel, logging and runtime dependency close the host contract',async()=>{
  const [digest,tunnel,caffeinate,market,learning,rotate,status,pkg,lock]=await Promise.all([
    read('ops/local-backend/digest-catchup.mjs'),read('ops/local-backend/cloudflared/config.yml.template'),read('ops/local-backend/launchd/com.xiuqiu.radar.caffeinate.plist.template'),read('ops/local-backend/launchd/com.xiuqiu.radar.market-worker.plist.template'),read('ops/local-backend/launchd/com.xiuqiu.radar.learning-worker.plist.template'),read('ops/local-backend/rotate-logs.mjs'),read('ops/local-backend/status.mjs'),read('package.json'),read('package-lock.json')])
  assert.match(digest,/Asia\/Shanghai/);assert.match(digest,/hour<8/);assert.match(digest,/already_succeeded/);assert.match(digest,/learning-radar:worker[\s\S]*market-radar:worker[\s\S]*rename\(temporary,marker\)/)
  assert.match(tunnel,/__FIXED_RADAR_PUBLIC_HOSTNAME__/);assert.match(tunnel,/127\.0\.0\.1:4320/);assert.doesNotMatch(tunnel,/4321|trycloudflare/)
  assert.match(caffeinate,/\/usr\/bin\/caffeinate/);assert.match(caffeinate,/<key>KeepAlive<\/key><true\/>/)
  assert.match(market,/<integer>1200<\/integer>/);assert.match(learning,/<integer>3600<\/integer>/)
  assert.match(rotate,/contentNames/);assert.match(rotate,/hermesNames/);assert.match(rotate,/terminal-output/);assert.match(rotate,/maxFiles=100/);assert.match(rotate,/isSymbolicLink/);assert.match(status,/cpuPercent/);assert.match(status,/rssKb/);assert.match(status,/secretsReported:false/)
  assert.match(status,/CONTENT_API_LAUNCHD_LABEL/);assert.match(status,/configured:false/);assert.doesNotMatch(status,/content\.postgres',55432/)
  assert.equal(JSON.parse(pkg).dependencies.pg,'^8.16.3');assert.equal(JSON.parse(lock).packages[''].dependencies.pg,'^8.16.3')
})

test('08:00 Shanghai catch-up retries partial failure and keeps lock errors distinct',async()=>{
  const root=await mkdtemp(join(tmpdir(),'radar-digest-'));const calls=[]
  const run=async(_command,args)=>{calls.push(args);if(calls.length===2)throw new Error('market failed')}
  assert.equal((await runDigestCatchup({now:new Date('2026-08-11T23:59:00Z'),stateDir:root,npmBin:'/bin/npm',run})).reason,'before_08_shanghai')
  await assert.rejects(runDigestCatchup({now:new Date('2026-08-12T00:00:00Z'),stateDir:root,npmBin:'/bin/npm',run}),/market failed/)
  await assert.rejects(readFile(join(root,'digest','last-successful-date'),'utf8'),error=>error.code==='ENOENT')
  const repaired=await runDigestCatchup({now:new Date('2026-08-12T00:01:00Z'),stateDir:root,npmBin:'/bin/npm',run:async()=>{}});assert.equal(repaired.status,'succeeded')
  assert.equal((await runDigestCatchup({now:new Date('2026-08-12T01:00:00Z'),stateDir:root,npmBin:'/bin/npm',run:async()=>{throw new Error('must not run')}})).reason,'already_succeeded')
  await writeFile(join(root,'digest','last-successful-date'),'2026-08-11\n');await (await import('node:fs/promises')).mkdir(join(root,'digest','catchup.lock'))
  assert.equal((await runDigestCatchup({now:new Date('2026-08-12T02:00:00Z'),stateDir:root,npmBin:'/bin/npm',run:async()=>{}})).reason,'catchup_locked')
  const denied={...await import('node:fs/promises'),readFile:async()=>{const error=new Error('denied');error.code='EACCES';throw error}}
  await assert.rejects(runDigestCatchup({now:new Date('2026-08-13T02:00:00Z'),stateDir:root,npmBin:'/bin/npm',fileSystem:denied,run:async()=>{}}),/denied/)
  await rm(root,{recursive:true,force:true})
})

test('verified handoff prevents a duplicate first-start digest after 08:00 Shanghai',async()=>{
  const root=await mkdtemp(join(tmpdir(),'radar-handoff-'))
  await assert.rejects(writeDigestHandoff({now:new Date('2026-08-11T23:59:00Z'),stateDir:root,verifiedReceiptId:'provider-message-1'}),/only valid after 08:00/)
  const handoff=await writeDigestHandoff({now:new Date('2026-08-12T00:01:00Z'),stateDir:root,verifiedReceiptId:'provider-message-1'});assert.equal(handoff.date,'2026-08-12');assert.equal(handoff.secretsPrinted,false)
  let runs=0;const result=await runDigestCatchup({now:new Date('2026-08-12T00:02:00Z'),stateDir:root,npmBin:'/bin/npm',run:async()=>{runs++}})
  assert.equal(result.reason,'verified_delivery_handoff');assert.equal(runs,0)
  const marker=join(root,'digest','handoff','2026-08-12.json');const value=await readFile(marker,'utf8');assert.doesNotMatch(value,/provider-message-1/);assert.match(value,/sha256:[a-f0-9]{64}/);assert.equal((await stat(marker)).mode&0o777,0o600)
  await rm(root,{recursive:true,force:true})
})

test('rotation copytruncates, gzips, prunes old generations and rejects symlinks',async()=>{
  const root=await mkdtemp(join(tmpdir(),'radar-rotate-'));const log=join(root,'public-api.out.log');const manifest=join(root,'manifest');const content=join(root,'content');const primary=join(root,'primary','logs');const secondary=join(root,'secondary','logs');const primaryHome=join(root,'primary');const secondaryHome=join(root,'secondary');const cronDirectory=join(primaryHome,'cache','terminal-output');const otherCronDirectory=join(secondaryHome,'cache','terminal-output');const cronManifest=join(root,'cron-manifest')
  await (await import('node:fs/promises')).mkdir(cronDirectory,{recursive:true});await (await import('node:fs/promises')).mkdir(otherCronDirectory,{recursive:true});await writeFile(cronManifest,`${cronDirectory}\n${otherCronDirectory}\n`,{mode:0o600})
  for(const name of ['newest','overflow','expired'])await writeFile(join(cronDirectory,name),name);const cronOld=new Date(Date.now()-15*86_400_000);await (await import('node:fs/promises')).utimes(join(cronDirectory,'expired'),cronOld,cronOld)
  await writeFile(manifest,`${log}\n`,{mode:0o600});await writeFile(log,'active-log-content');await writeFile(`${log}.1.gz`,'old');const archiveOld=new Date(Date.now()-15*86_400_000);await (await import('node:fs/promises')).utimes(`${log}.1.gz`,archiveOld,archiveOld)
  const roots={radar:root,content,primary,secondary};const cronRoots={primary:primaryHome,secondary:secondaryHome};const result=await rotateLogs({manifest,cronManifest,roots,cronRoots,threshold:1,cronMaxFiles:1});assert.equal(result.rotated,1);assert.equal((await stat(log)).size,0);assert.equal((await readFile(`${log}.1.gz`)).subarray(0,2).toString('hex'),'1f8b');assert.ok(result.pruned>=1);assert.equal(result.cron.pruned,2)
  await rm(`${log}.1.gz`);await rm(log);await symlink(join(root,'target'),log);await assert.rejects(rotateLogs({manifest,cronManifest,roots,cronRoots,threshold:1}),/unsafe log path/)
  await rm(log);await writeFile(log,'regular');await symlink(join(root,'target'),join(otherCronDirectory,'unsafe'));await assert.rejects(rotateLogs({manifest,cronManifest,roots,cronRoots,threshold:99}),/unsafe cron output path/)
  await rm(root,{recursive:true,force:true})
})

test('test cleanup signals only allowlisted fixture commands',async()=>{
  const root=await mkdtemp(join(tmpdir(),'radar-cleanup-'));const directory=join(root,'test-pids');await (await import('node:fs/promises')).mkdir(directory);await writeFile(join(directory,'test-a.pid'),'101');await writeFile(join(directory,'test-b.pid'),'102')
  const signalled=[];const result=await cleanupTestProcesses({stateDir:root,readCommand:async pid=>pid===101?'/repo/ops/local-backend/server.mjs --test-fixture':'/usr/bin/unrelated',signal:pid=>signalled.push(pid)})
  assert.equal(result.cleaned,1);assert.deepEqual(signalled,[101]);await rm(root,{recursive:true,force:true})
})

test('install renderer creates a new 0600 tree with independent secrets and never overwrites',async()=>{
  const parent=await mkdtemp(join(tmpdir(),'radar-render-'));const target=join(parent,'install');const repo=new URL('../',import.meta.url).pathname
  const options={target,repo,nodeBin:'/usr/bin/true',npmBin:'/usr/bin/true',pageOrigin:'https://xiuqiu-site.vercel.app',databaseUrl:'postgresql://xiuqiu_radar_app@localhost/xiuqiu_radar?host=%2Fprivate%2Ftmp%2Fsocket&port=55432',postgresSocketDir:'/private/tmp/socket',contentLogDir:'/private/tmp/content-logs',hermesPrimaryLogDir:'/private/tmp/hermes-primary',hermesSecondaryLogDir:'/private/tmp/hermes-secondary',hermesPrimaryHome:'/private/tmp/hermes-home',hermesSecondaryHome:'/private/tmp/hermes-secondary-home',gitSha:'a'.repeat(40)}
  const result=await renderInstall(options);assert.equal(result.secretsPrinted,false);assert.equal(result.tunnelRendered,false)
  const envPath=join(target,'config','radar.env');const env=await readFile(envPath,'utf8');const publicSecret=env.match(/RADAR_PUBLIC_HMAC_KEYS='\{"vercel-radar":"([^"]+)/)?.[1];const internalSecret=env.match(/RADAR_INTERNAL_HMAC_KEYS='\{"hermes-local":"([^"]+)/)?.[1]
  assert.ok(publicSecret?.length>=32);assert.ok(internalSecret?.length>=32);assert.notEqual(publicSecret,internalSecret);assert.match(env,/RADAR_ENABLE_QIU_MARKET=false/);assert.equal((await stat(envPath)).mode&0o777,0o600)
  const receipt=await readFile(join(target,'install-receipt.json'),'utf8');assert.doesNotMatch(receipt,new RegExp(publicSecret));assert.doesNotMatch(receipt,new RegExp(internalSecret));assert.match(receipt,/"gitSha": "a{40}"/)
  assert.match(receipt,/write_today_handoff_marker/);assert.match(receipt,/"automaticDuplicateSendAllowed": false/);assert.equal((await stat(join(target,'config','cron-output-directories.txt'))).mode&0o777,0o600)
  for(const name of ['public-api','internal-api','market-worker','learning-worker','digest','log-rotation','caffeinate'])assert.equal((await stat(join(target,'launchd',`com.xiuqiu.radar.${name}.plist`))).mode&0o777,0o600)
  await assert.rejects(renderInstall(options),error=>error.code==='EEXIST')
  await assert.rejects(renderInstall({...options,target:join(parent,'partial-tunnel'),hostname:'radar.example.com'}),/must be complete/)
  await rm(parent,{recursive:true,force:true})
})

test('local Git snapshot publisher uses pg, exact clean HEAD and parameterized publication writes',async()=>{
  const before={local:process.env.RADAR_LOCAL_BACKEND,driver:process.env.RADAR_DATABASE_DRIVER};process.env.RADAR_LOCAL_BACKEND='true';process.env.RADAR_DATABASE_DRIVER='pg'
  const statements=[];const client={query:async(statement,values=[])=>{statements.push({statement,values});return{rows:[],rowCount:/insert into (?:market_radar|learning_radar)\./.test(statement)?1:0}}};const pool={connect:async()=>client,end:async()=>{},};client.release=()=>{}
  const repo=new URL('../',import.meta.url).pathname.replace(/\/$/,'');const sha='b'.repeat(40)
  const git=async(_command,args)=>({stdout:args.includes('rev-parse')?`${sha}\n`:''})
  try{
    const result=await publishLocalGitSnapshots({repo,databaseUrl:'postgresql://xiuqiu_radar_app@localhost/xiuqiu_radar?host=%2Fprivate%2Ftmp%2Fsocket&port=55432',dates:['2026-08-12'],git,poolFactory:options=>{assert.equal(options.max,1);assert.equal(options.connectionTimeoutMillis,5_000);return pool}})
    assert.equal(result.gitSha,sha);assert.equal(result.driver,'pg');assert.equal(result.fixtures,false);assert.equal(result.snapshots.length,2)
    const inserts=statements.filter(entry=>entry.statement.includes('insert into radar_system.publication_snapshots'));assert.equal(inserts.length,2);assert.ok(inserts.every(entry=>entry.values[7]===sha));assert.ok(inserts.every(entry=>entry.values.length===8));assert.ok(statements.some(entry=>entry.statement.includes('insert into market_radar.events')));assert.ok(statements.some(entry=>entry.statement.includes('insert into learning_radar.stories')));assert.ok(statements.filter(entry=>entry.statement.includes('insert into market_radar.event_sources')).every(entry=>entry.values.at(-1) instanceof Date||entry.values.at(-1)));assert.equal(statements[0].statement,'begin');assert.equal(statements.at(-1).statement,'commit')
    await assert.rejects(publishLocalGitSnapshots({repo,databaseUrl:'postgresql://xiuqiu_radar_app@localhost/xiuqiu_radar?host=%2Fprivate%2Ftmp%2Fsocket&port=55432',dates:['2026-08-12'],git:async(_command,args)=>({stdout:args.includes('status')?'?? untracked\n':args.includes('rev-parse')?`${sha}\n`:''}),poolFactory:()=>pool}),/exact clean Git commit/)
  }finally{if(before.local===undefined)delete process.env.RADAR_LOCAL_BACKEND;else process.env.RADAR_LOCAL_BACKEND=before.local;if(before.driver===undefined)delete process.env.RADAR_DATABASE_DRIVER;else process.env.RADAR_DATABASE_DRIVER=before.driver}
})

test('Learning materialization rejects a non-official single Tier 1 source',async()=>{
  const publication={origin:'research',publicationState:'published',snapshotId:'learning-2026-08-12-0123456789abcdef',asOf:'2026-08-12T00:00:00Z',payload:{briefs:[{id:'unofficial',domain:'ai',title:'Unofficial source brief',whatHappened:'A sufficiently detailed event description from a non-official publisher.',whyItMatters:'This should not pass the official single-source publication gate.',mechanism:'Mechanism text long enough for the materializer.',workedExample:'Worked example text long enough for the materializer.',risksAndLimits:['A bounded risk description.'],nextQuestions:['A bounded follow-up question?'],sources:[{tier:'tier1',role:'event',kind:'news_report',name:'Example News',url:'https://example.com/report',publishedAt:'2026-08-11'}]}],deepDive:{id:'deep',basedOnBriefId:'unofficial',domain:'ai',title:'Deep dive',whatHappened:'Deep dive event description.',whyItMatters:'Deep dive relevance.',mechanism:'Deep mechanism.',workedExample:'Deep example.',risksAndLimits:['Risk.'],nextQuestions:['Question?'],sources:[{tier:'tier1',role:'event',kind:'news_report',name:'Example News',url:'https://example.com/deep',publishedAt:'2026-08-11'}]}}}
  await assert.rejects(materializeRadarPublication({query:async()=>({rows:[],rowCount:1})},'learning',publication),/publication_basis_missing/)
})

test('Learning materialization never treats an arbitrary GitHub protocol commit as official',async()=>{
  const brief={id:'attacker',domain:'web3',title:'Unowned protocol claim',whatHappened:'An arbitrary repository presents a protocol commit as if it were official.',whyItMatters:'Repository ownership must be checked before single-source publication.',mechanism:'Owner and path are verified together.',workedExample:'An attacker path must fail closed.',risksAndLimits:['Owner names can be deceptive.'],nextQuestions:['Is the owner explicitly allowlisted?'],sources:[{tier:'tier1',role:'event',kind:'protocol_commit',name:'Unowned commit',url:'https://github.com/attacker/repo/commit/0123456789abcdef',publishedAt:'2026-08-11T00:00:00Z'}]}
  const publication={origin:'research',publicationState:'published',snapshotId:'learning-2026-08-12-fedcba9876543210',asOf:'2026-08-12T00:00:00Z',payload:{briefs:[brief],deepDive:{...brief,id:'attacker-deep',basedOnBriefId:'attacker'}}}
  await assert.rejects(materializeRadarPublication({query:async()=>({rows:[],rowCount:1})},'learning',publication),/publication_basis_missing/)
})

test('log rotation refuses a symlink even when its name is allowlisted',async()=>{
  const root=await mkdtemp(join(tmpdir(),'radar-log-'));const target=join(root,'target');const log=join(root,'public-api.out.log');const manifest=join(root,'manifest');await writeFile(target,'x');await symlink(target,log);await writeFile(manifest,`${log}\n`,{mode:0o600})
  const result=spawnSync(process.execPath,[new URL('../ops/local-backend/rotate-logs.mjs',import.meta.url).pathname],{encoding:'utf8',env:{...process.env,RADAR_LOG_MANIFEST:manifest,RADAR_LOG_DIR:root,RADAR_CONTENT_LOG_DIR:join(root,'content'),RADAR_HERMES_PRIMARY_LOG_DIR:join(root,'primary','logs'),RADAR_HERMES_SECONDARY_LOG_DIR:join(root,'secondary','logs'),RADAR_HERMES_PRIMARY_HOME:join(root,'primary'),RADAR_HERMES_SECONDARY_HOME:join(root,'secondary')}})
  await rm(root,{recursive:true,force:true});assert.notEqual(result.status,0);assert.match(result.stderr,/unsafe log path/)
})
