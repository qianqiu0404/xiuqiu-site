import * as fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

function shanghaiParts(now) {
  const values=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(part=>[part.type,part.value]))
  return {date:`${values.year}-${values.month}-${values.day}`,hour:Number(values.hour)}
}

async function spawnCommand(command,args,extra={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',env:{...process.env,...extra}});child.once('exit',code=>code===0?resolve():reject(new Error(`${command} exited ${code}`)));child.once('error',reject)})}

export async function runDigestCatchup({
  now=new Date(), stateDir=process.env.RADAR_STATE_DIR, npmBin=process.env.RADAR_NPM_BIN,
  fileSystem=fs, run=spawnCommand,
}={}) {
  if(!stateDir)throw new Error('RADAR_STATE_DIR is required')
  if(!npmBin||!npmBin.startsWith('/'))throw new Error('RADAR_NPM_BIN must be absolute')
  const {date,hour}=shanghaiParts(now)
  if(hour<8)return{skipped:true,reason:'before_08_shanghai',date}
  await fileSystem.mkdir(join(stateDir,'digest'),{recursive:true})
  const marker=join(stateDir,'digest','last-successful-date');const lock=join(stateDir,'digest','catchup.lock')
  const handoff=join(stateDir,'digest','handoff',`${date}.json`)
  try{
    const info=await fileSystem.lstat(handoff);if(info.isSymbolicLink()||!info.isFile()||(info.mode&0o777)!==0o600)throw new Error('Digest handoff marker must be regular, non-symlink and 0600')
    const value=JSON.parse(await fileSystem.readFile(handoff,'utf8'))
    if(value.date!==date||!/^sha256:[a-f0-9]{64}$/.test(value.receiptHash||''))throw new Error('Digest handoff marker is invalid')
    return{skipped:true,reason:'verified_delivery_handoff',date}
  }catch(error){if(error.code!=='ENOENT')throw error}
  try{if((await fileSystem.readFile(marker,'utf8')).trim()===date)return{skipped:true,reason:'already_succeeded',date}}catch(error){if(error.code!=='ENOENT')throw error}
  try{await fileSystem.mkdir(lock)}catch(error){if(error.code==='EEXIST')return{skipped:true,reason:'catchup_locked',date};throw error}
  try{
    await run(npmBin,['run','learning-radar:worker','--','--digest=daily'],{REQUESTED_MODE:'daily'})
    await run(npmBin,['run','market-radar:worker','--','--digest=daily'])
    const temporary=`${marker}.${process.pid}`;await fileSystem.writeFile(temporary,`${date}\n`,{mode:0o600});await fileSystem.rename(temporary,marker)
    return{status:'succeeded',date,learning:true,market:true}
  }finally{await fileSystem.rmdir(lock)}
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  console.log(JSON.stringify(await runDigestCatchup()))
}
