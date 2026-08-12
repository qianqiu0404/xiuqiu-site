import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import { join } from 'node:path'

function shanghaiParts(now){
  const values=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(part=>[part.type,part.value]))
  return{date:`${values.year}-${values.month}-${values.day}`,hour:Number(values.hour)}
}

export async function writeDigestHandoff({now=new Date(),stateDir=process.env.RADAR_STATE_DIR,verifiedReceiptId,fileSystem=fs}={}){
  if(!stateDir)throw new Error('RADAR_STATE_DIR is required')
  if(typeof verifiedReceiptId!=='string'||!verifiedReceiptId.trim()||verifiedReceiptId.length>512)throw new Error('A verified remote delivery receipt id is required')
  const {date,hour}=shanghaiParts(now);if(hour<8)throw new Error('Digest handoff is only valid after 08:00 Asia/Shanghai')
  const directory=join(stateDir,'digest','handoff');await fileSystem.mkdir(directory,{recursive:true,mode:0o700})
  const path=join(directory,`${date}.json`);const receiptHash=`sha256:${createHash('sha256').update(verifiedReceiptId).digest('hex')}`
  await fileSystem.writeFile(path,`${JSON.stringify({schemaVersion:1,date,receiptHash,verifiedAt:new Date(now).toISOString()})}\n`,{mode:0o600,flag:'wx'})
  return{status:'handoff_recorded',date,secretsPrinted:false}
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const index=process.argv.indexOf('--verified-receipt-id');if(index<0||!process.argv[index+1])throw new Error('--verified-receipt-id is required')
  console.log(JSON.stringify(await writeDigestHandoff({verifiedReceiptId:process.argv[index+1]})))
}
