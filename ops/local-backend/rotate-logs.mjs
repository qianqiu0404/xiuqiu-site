import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
import * as fs from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
const compress=promisify(gzip)
const radarNames=new Set(['public-api.out.log','public-api.err.log','internal-api.out.log','internal-api.err.log','market-worker.out.log','market-worker.err.log','learning-worker.out.log','learning-worker.err.log','digest.out.log','digest.err.log','log-rotation.out.log','log-rotation.err.log','tunnel.out.log','tunnel.err.log'])
const contentNames=new Set(['api.log','api.error.log','postgres.log','postgres.error.log','tunnel.log','tunnel.error.log'])
const hermesNames=new Set(['gateway.log','gateway.error.log','agent.log','errors.log','gateway-exit-diag.log','gateway-shutdown-diag.log','gateway_faulthandler.log'])
const primaryOnlyHermesNames=new Set(['learning-radar-dispatch.log'])

async function readManifest(path,fileSystem){
  if(!path||!isAbsolute(path))throw new Error('Manifest path must be absolute')
  const info=await fileSystem.lstat(path)
  if(info.isSymbolicLink()||!info.isFile()||(info.mode&0o777)!==0o600)throw new Error('Manifest must be regular, non-symlink and 0600')
  const values=(await fileSystem.readFile(path,'utf8')).split(/\r?\n/).map(value=>value.trim()).filter(value=>value&&!value.startsWith('#'))
  if(new Set(values).size!==values.length)throw new Error('Duplicate path in manifest')
  return values
}

function logRoots(values={}){
  const roots={radar:values.radar||process.env.RADAR_LOG_DIR,content:values.content||process.env.RADAR_CONTENT_LOG_DIR,primary:values.primary||process.env.RADAR_HERMES_PRIMARY_LOG_DIR,secondary:values.secondary||process.env.RADAR_HERMES_SECONDARY_LOG_DIR}
  for(const [name,value] of Object.entries(roots))if(!value||!isAbsolute(value))throw new Error(`${name} log root must be absolute`)
  return roots
}

function cronRoots(values={}){
  const roots={primary:values.primary||process.env.RADAR_HERMES_PRIMARY_HOME,secondary:values.secondary||process.env.RADAR_HERMES_SECONDARY_HOME}
  for(const [name,value] of Object.entries(roots))if(!value||!isAbsolute(value))throw new Error(`${name} Hermes home must be absolute`)
  return roots
}

function validateLogPath(path,roots){
  if(!isAbsolute(path)||path.toLowerCase().includes('/qiu-market/'))throw new Error(`Disallowed log path: ${path}`)
  const directory=dirname(path);const name=basename(path)
  const allowed=(directory===roots.radar&&radarNames.has(name))||(directory===roots.content&&contentNames.has(name))||((directory===roots.primary||directory===roots.secondary)&&hermesNames.has(name))||(directory===roots.primary&&primaryOnlyHermesNames.has(name))
  if(!allowed)throw new Error(`Disallowed log path: ${path}`)
}

async function pruneCronOutputs({manifest,fileSystem,now,roots,maxFiles=100}){
  if(!manifest)return{directories:0,pruned:0,maxFilesPerProfile:maxFiles}
  const paths=await readManifest(manifest,fileSystem)
  const allowed=new Set([join(roots.primary,'cache','terminal-output'),join(roots.secondary,'cache','terminal-output')])
  let pruned=0
  for(const directory of paths){
    if(!allowed.has(directory)||directory.toLowerCase().includes('/qiu-market/'))throw new Error(`Disallowed cron output directory: ${directory}`)
    let directoryInfo;try{directoryInfo=await fileSystem.lstat(directory)}catch(error){if(error.code==='ENOENT')continue;throw error}
    if(directoryInfo.isSymbolicLink()||!directoryInfo.isDirectory())throw new Error(`Refusing unsafe cron output directory: ${directory}`)
    const entries=await fileSystem.readdir(directory,{withFileTypes:true});const files=[]
    for(const entry of entries){
      const path=join(directory,entry.name);const info=await fileSystem.lstat(path)
      if(entry.isSymbolicLink()||info.isSymbolicLink()||!entry.isFile()||!info.isFile())throw new Error(`Refusing unsafe cron output path: ${path}`)
      files.push({path,mtimeMs:info.mtimeMs})
    }
    files.sort((left,right)=>right.mtimeMs-left.mtimeMs)
    for(const [index,file] of files.entries())if(index>=maxFiles||now-file.mtimeMs>14*86_400_000){await fileSystem.unlink(file.path);pruned++}
  }
  return{directories:paths.length,pruned,maxFilesPerProfile:maxFiles}
}

export async function rotateLogs({manifest=process.env.RADAR_LOG_MANIFEST,cronManifest=process.env.RADAR_CRON_OUTPUT_MANIFEST,roots:rootValues,cronRoots:cronRootValues,fileSystem=fs,now=Date.now(),threshold=10*1024*1024,cronMaxFiles=100}={}){
  const roots=logRoots(rootValues);const paths=await readManifest(manifest,fileSystem)
  let rotated=0,pruned=0
  for(const path of paths){
    validateLogPath(path,roots)
    let info;try{info=await fileSystem.lstat(path)}catch(error){if(error.code==='ENOENT')continue;throw error}
    if(info.isSymbolicLink()||!info.isFile())throw new Error(`Refusing unsafe log path: ${path}`)
    for(let index=1;index<=7;index++){
      const archive=`${path}.${index}.gz`
      try{const archived=await fileSystem.lstat(archive);if(archived.isSymbolicLink()||!archived.isFile())throw new Error(`Refusing unsafe archive path: ${archive}`);if(now-archived.mtimeMs>14*86_400_000){await fileSystem.unlink(archive);pruned++}}catch(error){if(error.code!=='ENOENT')throw error}
    }
    if(info.size<threshold)continue
    try{await fileSystem.unlink(`${path}.7.gz`);pruned++}catch(error){if(error.code!=='ENOENT')throw error}
    for(let index=6;index>=1;index--){try{await fileSystem.rename(`${path}.${index}.gz`,`${path}.${index+1}.gz`)}catch(error){if(error.code!=='ENOENT')throw error}}
    const snapshot=await fileSystem.readFile(path);const temporary=`${path}.${process.pid}.gz.tmp`
    await fileSystem.writeFile(temporary,await compress(snapshot),{mode:0o600,flag:'wx'});await fileSystem.truncate(path,0);await fileSystem.rename(temporary,`${path}.1.gz`);rotated++
  }
  const cron=await pruneCronOutputs({manifest:cronManifest,fileSystem,now,roots:cronRoots(cronRootValues),maxFiles:cronMaxFiles})
  return{status:'ok',paths:paths.length,rotated,pruned,cron,copytruncate:true,compressed:true,retentionDays:14,generations:7}
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)console.log(JSON.stringify(await rotateLogs()))
