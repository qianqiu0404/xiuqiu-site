import { lstat, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { signArticleCatalogRequest } from '../../lib/article-catalog-auth.js'
const exec=promisify(execFile);const state=process.env.RADAR_STATE_DIR
if(!state)throw new Error('RADAR_STATE_DIR is required')
async function ps(pid){if(!pid)return{cpuPercent:null,rssKb:null,command:null};try{const {stdout}=await exec('/bin/ps',['-p',String(pid),'-o','%cpu=,rss=,comm=']);const match=stdout.trim().match(/^([\d.]+)\s+(\d+)\s+(.+)$/);return match?{cpuPercent:Number(match[1]),rssKb:Number(match[2]),command:match[3]}:{cpuPercent:null,rssKb:null,command:null}}catch{return{cpuPercent:null,rssKb:null,command:null}}}
async function portOwner(port){try{const {stdout}=await exec('/usr/sbin/lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-t']);return stdout.trim().split(/\s+/).filter(Boolean).map(Number)}catch{return[]}}
async function launch(label,port=null){
  if(!label)return{label:null,configured:false,loaded:false,pid:null,lastExitStatus:null,port,portOwners:port?await portOwner(port):[],...(await ps(null))}
  let text='';try{({stdout:text}=await exec('/bin/launchctl',['print',`gui/${process.getuid()}/${label}`]))}catch{return{label,configured:true,loaded:false,pid:null,lastExitStatus:null,port,portOwners:port?await portOwner(port):[],...(await ps(null))}}
  const pid=Number(text.match(/\bpid = (\d+)/)?.[1])||null;const lastExitStatus=Number(text.match(/last exit code = (-?\d+)/)?.[1])
  return{label,configured:true,loaded:true,pid,lastExitStatus:Number.isFinite(lastExitStatus)?lastExitStatus:null,port,portOwners:port?await portOwner(port):[],...(await ps(pid))}
}
async function signedHealth(port,keysValue,target='/healthz'){let keys={};try{keys=JSON.parse(keysValue||'{}')}catch{}const keyId=Object.keys(keys)[0];if(!keyId)return{ok:false,httpStatus:null,reason:'hmac_unconfigured'};try{const headers=signArticleCatalogRequest({secret:keys[keyId],keyId,target});const response=await fetch(`http://127.0.0.1:${port}${target}`,{headers});const value=await response.json().catch(()=>({}));return{ok:response.ok,httpStatus:response.status,status:value.status||null,generatedAt:value.generatedAt||null,latestEventAt:value.latestEventAt||null,freshnessMinutes:value.freshnessMinutes??null,isDelayed:value.isDelayed??null}}catch{return{ok:false,httpStatus:null,reason:'unreachable'}}}
async function heartbeat(directory){if(!directory)return{configured:false};try{const info=await lstat(join(directory,'state','gateway.heartbeat'));let value={};try{value=JSON.parse(await readFile(join(directory,'gateway_state.json'),'utf8'))}catch{}return{configured:true,regular:info.isFile()&&!info.isSymbolicLink(),ageSeconds:Math.max(0,Math.round((Date.now()-info.mtimeMs)/1000)),gatewayState:value.gateway_state||null,weixinStatus:value.platform_statuses?.weixin||null}}catch(error){return{configured:true,regular:false,error:error.code==='ENOENT'?'missing':'unavailable'}}}
let digestDate=null;try{digestDate=(await readFile(join(state,'digest','last-successful-date'),'utf8')).trim()}catch(error){if(error.code!=='ENOENT')throw error}
const socketDirectory=process.env.CONTENT_POSTGRES_SOCKET_DIR||'';let postgresSocket={directory:socketDirectory,port:55432,exists:false,symlink:false}
if(socketDirectory)try{const info=await lstat(join(socketDirectory,'.s.PGSQL.55432'));postgresSocket.exists=info.isSocket();postgresSocket.symlink=info.isSymbolicLink()}catch(error){if(error.code!=='ENOENT')postgresSocket.error='unavailable'}
const services=await Promise.all([
  launch('com.xiuqiu.radar.public-api',4320),launch('com.xiuqiu.radar.internal-api',4321),launch('com.xiuqiu.radar.market-worker'),launch('com.xiuqiu.radar.learning-worker'),launch('com.xiuqiu.radar.digest'),launch('com.xiuqiu.radar.tunnel'),launch('com.xiuqiu.radar.caffeinate'),
  launch(process.env.CONTENT_API_LAUNCHD_LABEL||null,4318),launch(process.env.CONTENT_POSTGRES_LAUNCHD_LABEL||null),launch(process.env.RADAR_HERMES_PRIMARY_LAUNCHD_LABEL||null),launch(process.env.RADAR_HERMES_SECONDARY_LAUNCHD_LABEL||null),
])
console.log(JSON.stringify({generatedAt:new Date().toISOString(),services,health:{contentApi:await signedHealth(4318,process.env.ARTICLE_CATALOG_HMAC_KEYS_JSON,'/health'),public:await signedHealth(4320,process.env.RADAR_PUBLIC_HMAC_KEYS),marketFreshness:await signedHealth(4320,process.env.RADAR_PUBLIC_HMAC_KEYS,'/v1/market-radar/summary'),learningFreshness:await signedHealth(4320,process.env.RADAR_PUBLIC_HMAC_KEYS,'/v1/learning-radar/summary'),internal:await signedHealth(4321,process.env.RADAR_INTERNAL_HMAC_KEYS),postgresSocket,hermesPrimary:await heartbeat(process.env.RADAR_HERMES_PRIMARY_HOME),hermesSecondary:await heartbeat(process.env.RADAR_HERMES_SECONDARY_HOME)},digest:{lastSuccessfulShanghaiDate:digestDate},observedPorts:[4318,4320,4321,55432],secretsReported:false}))
