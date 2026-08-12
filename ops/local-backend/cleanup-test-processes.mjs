import * as fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
const exec=promisify(execFile)

export async function cleanupTestProcesses({stateDir=process.env.RADAR_STATE_DIR,fileSystem=fs,readCommand=async pid=>(await exec('/bin/ps',['-p',String(pid),'-o','command='])).stdout,signal=pid=>process.kill(pid,'SIGTERM')}={}){
  const directory=join(stateDir||'', 'test-pids');let names=[]
  try{names=await fileSystem.readdir(directory)}catch(error){if(error.code==='ENOENT')return{cleaned:0};throw error}
  let cleaned=0
  for(const name of names.filter(value=>/^test-[a-z0-9-]+\.pid$/.test(value))){const path=join(directory,name);const info=await fileSystem.lstat(path);if(info.isSymbolicLink()||!info.isFile())throw new Error('Refusing unsafe test pid path');const pid=Number((await fileSystem.readFile(path,'utf8')).trim());if(Number.isInteger(pid)&&pid>1){try{const command=await readCommand(pid);if(command.includes('/ops/local-backend/')&&command.includes('--test-fixture')){signal(pid);cleaned++}}catch{}}await fileSystem.unlink(path)}
  return{cleaned}
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)console.log(JSON.stringify(await cleanupTestProcesses()))
