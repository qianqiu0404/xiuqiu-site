import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { createRadarPool, localRadarDatabaseUrl } from '../../market-radar/worker/database-pool.mjs'
import { readRadarPublication, radarPublicationPath } from '../../scripts/radar-publication-files.mjs'
import { publishRadarSnapshot } from '../../scripts/radar-publication-store.mjs'
import { materializeRadarPublication } from '../../scripts/radar-publication-materializer.mjs'
const exec=promisify(execFile)

export async function publishLocalGitSnapshots({repo,databaseUrl,dates,kinds=['learning','market'],git=exec,poolFactory=createRadarPool}={}){
  if(process.env.RADAR_LOCAL_BACKEND!=='true'||process.env.RADAR_DATABASE_DRIVER!=='pg')throw new Error('Local snapshot publishing requires RADAR_LOCAL_BACKEND=true and RADAR_DATABASE_DRIVER=pg')
  localRadarDatabaseUrl(databaseUrl)
  if(!repo?.startsWith('/')||!Array.isArray(dates)||!dates.length||dates.some(date=>!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw new Error('Exact repo and explicit YYYY-MM-DD dates are required')
  if(kinds.some(kind=>!['learning','market'].includes(kind)))throw new Error('Only learning and market snapshots are supported')
  const [{stdout:sha},{stdout:dirty}]=await Promise.all([
    git('/usr/bin/git',['-C',repo,'rev-parse','HEAD']),
    git('/usr/bin/git',['-C',repo,'status','--porcelain','--untracked-files=all']),
  ])
  if(dirty.trim())throw new Error('Local snapshot publishing requires an exact clean Git commit')
  const revision=sha.trim();if(!/^[0-9a-f]{40}$/.test(revision))throw new Error('Git revision is invalid')
  const publications=[];const repoUrl=pathToFileURL(`${repo}/`)
  for(const date of dates)for(const kind of kinds){
    const path=radarPublicationPath(repoUrl,kind,date)
    await git('/usr/bin/git',['-C',repo,'ls-files','--error-unmatch',decodeURIComponent(path.pathname).slice(repo.length+1)])
    const publication=readRadarPublication(path,kind,date)
    if(!publication)throw new Error(`${kind} radar ${date} is missing`)
    publications.push({date,kind,publication})
  }
  const pool=poolFactory({connectionString:databaseUrl,max:1,idleTimeoutMillis:10_000,connectionTimeoutMillis:5_000,application_name:'xiuqiu-radar-local-snapshot-publisher'})
  let client
  try{
    client=await pool.connect();await client.query('begin')
    for(const entry of publications){await publishRadarSnapshot(client,entry.kind,entry.publication,revision);await materializeRadarPublication(client,entry.kind,entry.publication)}
    await client.query('commit')
  }catch(error){if(client)await client.query('rollback').catch(()=>undefined);throw error}
  finally{client?.release();await pool.end()}
  return{gitSha:revision,snapshots:publications.map(({date,kind,publication})=>({date,kind,snapshotId:publication.snapshotId,asOf:publication.asOf})),driver:'pg',database:'xiuqiu_radar',fixtures:false,secretsPrinted:false}
}

function values(argv){const result={};for(let i=2;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined)throw new Error('Arguments must be --key value pairs');result[argv[i].slice(2)]=argv[i+1]}return result}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const input=values(process.argv)
  const result=await publishLocalGitSnapshots({repo:input.repo,databaseUrl:process.env.RADAR_LOCAL_DATABASE_URL,dates:String(input.dates||'').split(',').filter(Boolean),kinds:String(input.kinds||'learning,market').split(',')})
  console.log(JSON.stringify(result))
}
