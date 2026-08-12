import { createServer } from 'node:http'
import { Pool } from 'pg'
import { localRadarDatabaseUrl } from '../../market-radar/worker/database-pool.mjs'
import { createHmacVerifier, isLoopback } from './auth.mjs'
import { createOutboxRepository, createPublicRepository } from './repository.mjs'

export const RADAR_BIND_HOST = '127.0.0.1'
const PORTS = { public: 4320, internal: 4321 }

export function radarPoolOptions(scope,connectionString) {
  if(!PORTS[scope])throw new Error('scope must be public or internal')
  return {connectionString,max:2,idleTimeoutMillis:30_000,connectionTimeoutMillis:5_000,application_name:`xiuqiu-radar-${scope}`}
}

function send(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'private, no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(value))
}

async function bodyOf(req) {
  const chunks=[]; let size=0
  for await (const chunk of req) { size += chunk.length; if(size>32_768) throw Object.assign(new Error('body_too_large'),{status:413}); chunks.push(chunk) }
  return Buffer.concat(chunks).toString('utf8')
}

export function createRadarHandler({ scope, verify, query }) {
  if (!PORTS[scope]) throw new Error('scope must be public or internal')
  const publicRepo=createPublicRepository(query); const outbox=createOutboxRepository(query)
  return async (req,res) => {
    if(!isLoopback(req.socket?.remoteAddress)) return send(res,403,{code:'loopback_required'})
    let body=''; try { body=await bodyOf(req) } catch(error) { return send(res,error.status||400,{code:error.message}) }
    const target=req.url||'/'
    const auth=verify({method:req.method||'GET',target,body,headers:req.headers})
    if(!auth.ok) return send(res,auth.code==='replayed_signature'?409:401,{code:auth.code})
    const url=new URL(target,'http://127.0.0.1')
    try {
      if(req.method==='GET'&&url.pathname==='/healthz') {
        await query('select 1 as ready',[])
        return send(res,200,{status:'ok',scope,database:'ready'})
      }
      if(scope==='public'&&req.method==='GET') {
        if(url.pathname==='/v1/market-radar/summary') return send(res,200,await publicRepo.marketSummary())
        if(url.pathname==='/v1/market-radar/events') return send(res,200,await publicRepo.marketEvents(url))
        if(url.pathname==='/v1/market-radar/digests') return send(res,200,await publicRepo.marketDigests(url))
        const event=url.pathname.match(/^\/v1\/market-radar\/events\/([^/]+)$/); if(event){const value=await publicRepo.marketEvent(decodeURIComponent(event[1]));return send(res,value?200:404,value||{code:'event_not_found'})}
        if(url.pathname==='/v1/learning-radar/summary') return send(res,200,await publicRepo.learningSummary())
        if(url.pathname==='/v1/learning-radar/items') return send(res,200,await publicRepo.learningItems(url))
        if(url.pathname==='/v1/learning-radar/digests') return send(res,200,await publicRepo.learningDigests(url))
        const story=url.pathname.match(/^\/v1\/learning-radar\/stories\/([^/]+)$/); if(story){const value=await publicRepo.learningStory(decodeURIComponent(story[1]));return send(res,value?200:404,value||{code:'story_not_found'})}
      }
      if(scope==='internal'&&req.method==='POST') {
        const match=url.pathname.match(/^\/v1\/internal\/(market|learning)-radar\/outbox\/(claim|ack)$/)
        if(match){const payload=body?JSON.parse(body):{};const value=match[2]==='claim'?await outbox.claim(match[1],payload):await outbox.ack(match[1],payload);return send(res,200,value)}
      }
      return send(res,404,{code:'route_not_found'})
    } catch(error) { return send(res,error.status||503,{code:error.message==='lease_mismatch'?'lease_mismatch':'backend_unavailable'}) }
  }
}

export function createRuntime(scope, env=process.env) {
  const url=localRadarDatabaseUrl(env.RADAR_LOCAL_DATABASE_URL)
  const keyEnv=scope==='public'?env.RADAR_PUBLIC_HMAC_KEYS:env.RADAR_INTERNAL_HMAC_KEYS
  const pool=new Pool(radarPoolOptions(scope,url))
  const handler=createRadarHandler({scope,verify:createHmacVerifier(scope,keyEnv),query:async(sql,values)=>(await pool.query(sql,values)).rows})
  const server=createServer((req,res)=>handler(req,res))
  server.on('close',()=>pool.end())
  return server
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  const scope=process.argv.includes('--internal')?'internal':'public'
  createRuntime(scope).listen(PORTS[scope],RADAR_BIND_HOST,()=>console.log(JSON.stringify({status:'ready',scope,host:RADAR_BIND_HOST,port:PORTS[scope]})))
}
