import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { localRadarDatabaseUrl } from '../../market-radar/worker/database-pool.mjs'
const exec=promisify(execFile)

function safe(value,label){if(typeof value!=='string'||!value||value.includes('\n')||value.includes("'"))throw new Error(`${label} is invalid`);return value}
const quoted=value=>`'${safe(value,'environment value')}'`
const xml=value=>safe(value,'template value').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const replace=(source,values)=>Object.entries(values).reduce((result,[key,value])=>result.replaceAll(`__${key}__`,xml(value)),source)

export async function renderInstall(options){
  const {target,repo,nodeBin,npmBin,pageOrigin,contentLogDir,hermesPrimaryLogDir,hermesSecondaryLogDir,gitSha='test-sha',fileSystem={mkdir,readFile,writeFile,access,lstat,realpath}}=options
  for(const [label,value] of Object.entries({target,repo,nodeBin,npmBin,contentLogDir,hermesPrimaryLogDir,hermesSecondaryLogDir,hermesPrimaryHome:options.hermesPrimaryHome,hermesSecondaryHome:options.hermesSecondaryHome,postgresSocketDir:options.postgresSocketDir}))if(!isAbsolute(value||''))throw new Error(`${label} must be absolute`)
  const page=new URL(pageOrigin);if(page.protocol!=='https:'||page.username||page.password||page.search||page.hash||!['','/'].includes(page.pathname))throw new Error('pageOrigin must be a clean HTTPS origin')
  localRadarDatabaseUrl(options.databaseUrl)
  for(const binary of [nodeBin,npmBin]){await fileSystem.access(binary,constants.X_OK);const resolved=await fileSystem.realpath(binary);const info=await fileSystem.lstat(resolved);if(!info.isFile())throw new Error('Runtime binary target must be a file')}
  const tunnelValues=[options.hostname,options.tunnelId,options.tunnelCredentials,options.cloudflaredBin]
  const tunnelEnabled=tunnelValues.every(Boolean);if(tunnelValues.some(Boolean)&&!tunnelEnabled)throw new Error('Named tunnel parameters must be complete')
  await fileSystem.mkdir(target,{mode:0o700})
  for(const name of ['config','launchd','logs','state'])await fileSystem.mkdir(join(target,name),{mode:0o700})
  const envPath=join(target,'config','radar.env');const logManifest=join(target,'config','log-manifest.txt');const cronManifest=join(target,'config','cron-output-directories.txt')
  const publicSecret=randomBytes(36).toString('base64url');const internalSecret=randomBytes(36).toString('base64url')
  const lines=[
    'RADAR_LOCAL_BACKEND=true','RADAR_DATABASE_DRIVER=pg',
    `RADAR_LOCAL_DATABASE_URL=${quoted(options.databaseUrl)}`,
    `RADAR_PUBLIC_HMAC_KEYS=${quoted(JSON.stringify({'vercel-radar':publicSecret}))}`,
    `RADAR_INTERNAL_HMAC_KEYS=${quoted(JSON.stringify({'hermes-local':internalSecret}))}`,
    'RADAR_INTERNAL_HMAC_KEY_ID=hermes-local',`RADAR_INTERNAL_HMAC_SECRET=${internalSecret}`,
    'RADAR_ENABLE_QIU_MARKET=false',`RADAR_REPO_DIR=${quoted(repo)}`,`RADAR_STATE_DIR=${quoted(join(target,'state'))}`,
    `RADAR_LOG_DIR=${quoted(join(target,'logs'))}`,`RADAR_LOG_MANIFEST=${quoted(logManifest)}`,`RADAR_CRON_OUTPUT_MANIFEST=${quoted(cronManifest)}`,`RADAR_NODE_BIN=${quoted(nodeBin)}`,`RADAR_NPM_BIN=${quoted(npmBin)}`,
    `RADAR_CONTENT_LOG_DIR=${quoted(contentLogDir)}`,`RADAR_HERMES_PRIMARY_LOG_DIR=${quoted(hermesPrimaryLogDir)}`,`RADAR_HERMES_SECONDARY_LOG_DIR=${quoted(hermesSecondaryLogDir)}`,
    `RADAR_HERMES_PRIMARY_HOME=${quoted(options.hermesPrimaryHome)}`,`RADAR_HERMES_SECONDARY_HOME=${quoted(options.hermesSecondaryHome)}`,
    'CONTENT_API_LAUNCHD_LABEL=com.xiuqiu.content.api','CONTENT_POSTGRES_LAUNCHD_LABEL=com.xiuqiu.content.postgres',
    'RADAR_HERMES_PRIMARY_LAUNCHD_LABEL=ai.hermes.gateway','RADAR_HERMES_SECONDARY_LAUNCHD_LABEL=ai.hermes.gateway-radar-secondary',
    `CONTENT_POSTGRES_SOCKET_DIR=${quoted(options.postgresSocketDir)}`,
  ]
  if(tunnelEnabled)lines.push(`RADAR_PUBLIC_HOSTNAME=${quoted(options.hostname)}`,`RADAR_NAMED_TUNNEL_ID=${quoted(options.tunnelId)}`,`RADAR_CLOUDFLARED_BIN=${quoted(options.cloudflaredBin)}`,`RADAR_TUNNEL_CONFIG=${quoted(join(target,'config','cloudflared.yml'))}`,`RADAR_TUNNEL_CREDENTIALS=${quoted(options.tunnelCredentials)}`)
  await fileSystem.writeFile(envPath,`${lines.join('\n')}\n`,{mode:0o600,flag:'wx'})
  const manifestTemplate=await fileSystem.readFile(join(repo,'ops/local-backend/log-manifest.txt.template'),'utf8')
  await fileSystem.writeFile(logManifest,replace(manifestTemplate,{RADAR_LOG_DIR:join(target,'logs'),CONTENT_LOG_DIR:contentLogDir,HERMES_PRIMARY_LOG_DIR:hermesPrimaryLogDir,HERMES_SECONDARY_LOG_DIR:hermesSecondaryLogDir}),{mode:0o600,flag:'wx'})
  await fileSystem.writeFile(cronManifest,`${join(options.hermesPrimaryHome,'cache','terminal-output')}\n${join(options.hermesSecondaryHome,'cache','terminal-output')}\n`,{mode:0o600,flag:'wx'})
  const launchTemplates=['public-api','internal-api','market-worker','learning-worker','digest','log-rotation','caffeinate',...(tunnelEnabled?['tunnel']:[])]
  for(const name of launchTemplates){const source=await fileSystem.readFile(join(repo,'ops/local-backend/launchd',`com.xiuqiu.radar.${name}.plist.template`),'utf8');await fileSystem.writeFile(join(target,'launchd',`com.xiuqiu.radar.${name}.plist`),replace(source,{REPO:repo,ENV_FILE:envPath,LOG_DIR:join(target,'logs')}),{mode:0o600,flag:'wx'})}
  if(tunnelEnabled){const credentials=await fileSystem.lstat(options.tunnelCredentials);if(credentials.isSymbolicLink()||!credentials.isFile()||(credentials.mode&0o777)!==0o600)throw new Error('Tunnel credentials must be a regular non-symlink 0600 file');const source=await fileSystem.readFile(join(repo,'ops/local-backend/cloudflared/config.yml.template'),'utf8');await fileSystem.writeFile(join(target,'config','cloudflared.yml'),replace(source,{NAMED_TUNNEL_ID:options.tunnelId,NAMED_TUNNEL_CREDENTIALS:options.tunnelCredentials,FIXED_RADAR_PUBLIC_HOSTNAME:options.hostname}),{mode:0o600,flag:'wx'})}
  const receipt={schemaVersion:1,gitSha,pageOrigin,createdAt:new Date().toISOString(),tunnelRendered:tunnelEnabled,hermesPluginDeployment:'required-separate-step',digestFirstStart:{ifShanghaiAfter0800:'verify_existing_remote_delivery_receipt_then_write_today_handoff_marker_before_loading_digest_timer',automaticDuplicateSendAllowed:false},secretsPrinted:false}
  await fileSystem.writeFile(join(target,'install-receipt.json'),`${JSON.stringify(receipt,null,2)}\n`,{mode:0o600,flag:'wx'})
  return{target,gitSha,tunnelRendered:tunnelEnabled,files:launchTemplates.length+4+(tunnelEnabled?1:0),secretsPrinted:false}
}

function args(values){const result={};for(let index=2;index<values.length;index+=2){if(!values[index].startsWith('--')||values[index+1]===undefined)throw new Error('Arguments must be --key value pairs');result[values[index].slice(2)]=values[index+1]}return result}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const input=args(process.argv);const repo=input.repo
  const [{stdout:sha},{stdout:dirty}]=await Promise.all([exec('/usr/bin/git',['-C',repo,'rev-parse','HEAD']),exec('/usr/bin/git',['-C',repo,'status','--porcelain','--untracked-files=all'])])
  if(dirty.trim())throw new Error('Install rendering requires an exact clean commit')
  const result=await renderInstall({target:input.target,repo,nodeBin:input.node,npmBin:input.npm,pageOrigin:input['page-origin'],databaseUrl:input['database-url'],postgresSocketDir:input['postgres-socket'],contentLogDir:input['content-log-dir'],hermesPrimaryLogDir:input['hermes-primary-log-dir'],hermesSecondaryLogDir:input['hermes-secondary-log-dir'],hermesPrimaryHome:input['hermes-primary-home'],hermesSecondaryHome:input['hermes-secondary-home'],hostname:input.hostname,tunnelId:input['tunnel-id'],tunnelCredentials:input['tunnel-credentials'],cloudflaredBin:input.cloudflared,gitSha:sha.trim()})
  console.log(JSON.stringify(result))
}
