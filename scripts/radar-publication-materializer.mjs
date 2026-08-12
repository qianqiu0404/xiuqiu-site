import { createHash } from 'node:crypto'
import { registrableDomain } from '../learning-radar/worker/core.mjs'

const id=(prefix,...values)=>`${prefix}-${createHash('sha256').update(values.join('\0')).digest('hex').slice(0,24)}`
const dated=value=>{if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString();if(typeof value!=='string')return null;const normalized=/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T00:00:00Z`:value;return Number.isNaN(Date.parse(normalized))?null:new Date(normalized).toISOString()}
const host=value=>new URL(value).hostname.toLowerCase()
const OFFICIAL_SOURCE_KINDS=/^(?:official(?:_|$)|protocol_commit$|protocol_specification$)/
const OFFICIAL_HOSTS=new Set(['openai.com','anthropic.com','ledger.com','ethereum.org','eips.ethereum.org'])
function officialSource(source){
  if(source.tier!=='tier1'||!OFFICIAL_SOURCE_KINDS.test(source.kind))return false
  const url=new URL(source.url);const hostname=url.hostname.toLowerCase()
  if(hostname==='github.com')return (source.kind==='protocol_commit'&&/^\/ethereum\/EIPs\/(?:commit|commits)\/[0-9a-f]+\/?$/i.test(url.pathname))||(source.kind==='official_release'&&/^\/LedgerHQ\/[A-Za-z0-9._-]+\/(?:releases|commit|commits)(?:\/|$)/.test(url.pathname))
  return[...OFFICIAL_HOSTS].some(owner=>hostname===owner||hostname.endsWith(`.${owner}`))
}

async function exactInsert(sql,statement,values,label){
  const result=await sql.query(statement,values)
  if(result.rowCount!==1)throw new Error(`${label}_content_conflict`)
}

function marketNamespace(symbol){
  if(['BTC','ETH','SOL','HYPE','XRP','ZEC'].includes(symbol))return'crypto'
  if(['SPY','QQQ','NVDA','TSLA','COIN','MSTR','AAPL','MSFT'].includes(symbol))return'us_equity'
  return'macro'
}

async function materializeMarket(sql,publication){
  for(const event of publication.payload.events){
    const eventId=id('gitm',publication.snapshotId,event.id);const rawId=id('gitmr',publication.snapshotId,event.id,event.sourceUrl)
    const market=event.category==='crypto'?'crypto':event.category==='equity'?'us_equity':'macro'
    const sourceAt=dated(event.sourcePublishedAt);const occurredAt=dated(event.eventAt)||sourceAt
    const rawPayload={origin:'research',snapshotId:publication.snapshotId,originalId:event.id,source:{name:event.sourceName,url:event.sourceUrl,publishedAt:event.sourcePublishedAt}}
    await exactInsert(sql,`insert into market_radar.raw_items
      (id,provider,provider_id,market,source_url,title,published_at,payload,normalized_at)
      values ($1,'git_research_snapshot',$2,$3,$4,$5,$6,$7::jsonb,$8)
      on conflict (id) do update set id=excluded.id where
        market_radar.raw_items.provider=excluded.provider and market_radar.raw_items.provider_id=excluded.provider_id
        and market_radar.raw_items.market=excluded.market and market_radar.raw_items.source_url=excluded.source_url
        and market_radar.raw_items.title=excluded.title and market_radar.raw_items.published_at=excluded.published_at
        and market_radar.raw_items.payload=excluded.payload returning id`,
    [rawId,rawId,market,event.sourceUrl,event.title,sourceAt,JSON.stringify(rawPayload),publication.asOf],'market_raw')
    await exactInsert(sql,`insert into market_radar.events
      (id,slug,cluster_key,market,status,priority,score,title_zh,summary_zh,why_it_matters_zh,event_type,
        news_direction,system_judgment,horizon,ai_schema_version,occurred_at,published_at,watch_for_zh,
        invalidation_zh,origin,publication_state,snapshot_id)
      values ($1,$2,$3,$4,'published',$5,$6,$7,$8,$9,$10,'neutral',$11,'days','v2',$12,$13,$14,$15,'research','published',$16)
      on conflict (id) do update set id=excluded.id where market_radar.events.slug=excluded.slug
        and market_radar.events.market=excluded.market and market_radar.events.priority=excluded.priority
        and market_radar.events.title_zh=excluded.title_zh and market_radar.events.summary_zh=excluded.summary_zh
        and market_radar.events.why_it_matters_zh=excluded.why_it_matters_zh
        and market_radar.events.watch_for_zh=excluded.watch_for_zh and market_radar.events.invalidation_zh=excluded.invalidation_zh
        and market_radar.events.occurred_at=excluded.occurred_at and market_radar.events.snapshot_id=excluded.snapshot_id
        and market_radar.events.origin='research' and market_radar.events.publication_state='published' returning id`,
    [eventId,eventId,eventId,market,event.priority,event.priority==='P0'?90:event.priority==='P1'?75:55,event.title,event.fact,event.whyWatch,event.category,event.whyWatch,occurredAt,publication.asOf,event.watchFor,event.invalidation,publication.snapshotId],'market_event')
    await exactInsert(sql,`insert into market_radar.event_sources
      (event_id,raw_item_id,source_name,source_url,title,excerpt,published_at,is_primary)
      values ($1,$2,$3,$4,$5,$6,$7,true)
      on conflict (event_id,raw_item_id) do update set event_id=excluded.event_id where
        market_radar.event_sources.source_name=excluded.source_name and market_radar.event_sources.source_url=excluded.source_url
        and market_radar.event_sources.title=excluded.title and market_radar.event_sources.excerpt=excluded.excerpt
        and market_radar.event_sources.published_at=excluded.published_at and market_radar.event_sources.is_primary=true returning event_id`,
    [eventId,rawId,event.sourceName,event.sourceUrl,event.title,event.fact,sourceAt],'market_source')
    for(const rawSymbol of event.assets){const symbol=String(rawSymbol).toUpperCase();await exactInsert(sql,`insert into market_radar.event_assets
      (event_id,namespace,symbol,relevance) values ($1,$2,$3,100)
      on conflict (event_id,namespace,symbol) do update set event_id=excluded.event_id
      where market_radar.event_assets.relevance=excluded.relevance returning event_id`,[eventId,marketNamespace(symbol),symbol],'market_asset')}
  }
}

function learningCategory(brief){return brief.domain==='ai'?'ai':'web3_wallet'}
function learningSummary(brief){return brief.whatHappened}

async function materializeLearning(sql,publication){
  const briefs=[...publication.payload.briefs,{...publication.payload.deepDive,id:publication.payload.deepDive.id||`deep-dive-${publication.payload.deepDive.basedOnBriefId}`}]
  for(const [briefIndex,brief] of briefs.entries()){
    const storyId=id('gitl',publication.snapshotId,brief.id);const datedSources=brief.sources.filter(source=>dated(source.publishedAt))
    if(!datedSources.length)throw new Error('learning_materialization_requires_dated_source')
    const domains=new Set(datedSources.map(source=>registrableDomain(source.url)));const basis=datedSources.some(officialSource)?'official_primary':domains.size>=2?'independent_domains':null
    if(!basis)throw new Error('learning_materialization_publication_basis_missing')
    const occurredAt=datedSources.map(source=>dated(source.publishedAt)).sort()[0]
    await exactInsert(sql,`insert into learning_radar.stories
      (id,slug,cluster_key,category,status,importance,internal_score,title_zh,summary_zh,why_selected_zh,
        ai_schema_version,occurred_at,published_at,publication_basis,verification_state,has_conflict,
        conflict_evidence,origin,publication_state,snapshot_id)
      values ($1,$2,$3,$4,'published',$5,80,$6,$7,$8,'learning-v2-git',$9,$10,$11,'verified',false,'[]'::jsonb,'research','published',$12)
      on conflict (id) do update set id=excluded.id where learning_radar.stories.slug=excluded.slug
        and learning_radar.stories.category=excluded.category and learning_radar.stories.title_zh=excluded.title_zh
        and learning_radar.stories.summary_zh=excluded.summary_zh and learning_radar.stories.why_selected_zh=excluded.why_selected_zh
        and learning_radar.stories.occurred_at=excluded.occurred_at and learning_radar.stories.snapshot_id=excluded.snapshot_id
        and learning_radar.stories.origin='research' and learning_radar.stories.publication_state='published' returning id`,
    [storyId,storyId,storyId,learningCategory(brief),briefIndex<2?'key':'noteworthy',brief.title,learningSummary(brief),brief.whyItMatters,occurredAt,publication.asOf,basis,publication.snapshotId],'learning_story')
    for(const [sourceIndex,source] of datedSources.entries()){
      const rawId=id('gitlr',publication.snapshotId,brief.id,source.url);const sourceAt=dated(source.publishedAt);const sourceHost=host(source.url);const domain=registrableDomain(source.url)
      const rawPayload={origin:'research',snapshotId:publication.snapshotId,originalId:brief.id,source:{tier:source.tier,role:source.role,kind:source.kind,name:source.name,url:source.url,publishedAt:source.publishedAt}}
      await exactInsert(sql,`insert into learning_radar.raw_items
        (id,provider,provider_id,source_url,source_domain,title,excerpt,published_at,payload,normalized_at,
          origin_verified_at,is_official,discovered_via,verification_state)
        values ($1,'git_research_snapshot',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9,$10,'git_research_snapshot','verified')
        on conflict (id) do update set id=excluded.id where learning_radar.raw_items.provider=excluded.provider
          and learning_radar.raw_items.provider_id=excluded.provider_id and learning_radar.raw_items.source_url=excluded.source_url
          and learning_radar.raw_items.title=excluded.title and learning_radar.raw_items.published_at=excluded.published_at
          and learning_radar.raw_items.payload=excluded.payload and learning_radar.raw_items.verification_state='verified' returning id`,
      [rawId,rawId,source.url,sourceHost,source.name,brief.whatHappened,sourceAt,JSON.stringify(rawPayload),publication.asOf,officialSource(source)],'learning_raw')
      await exactInsert(sql,`insert into learning_radar.story_sources
        (story_id,raw_item_id,source_name,source_url,title,excerpt,published_at,is_primary,origin_verified_at,
          source_domain,registrable_domain,is_official,discovered_via,verification_state)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'git_research_snapshot','verified')
        on conflict (story_id,raw_item_id) do update set story_id=excluded.story_id where
          learning_radar.story_sources.source_name=excluded.source_name and learning_radar.story_sources.source_url=excluded.source_url
          and learning_radar.story_sources.title=excluded.title and learning_radar.story_sources.excerpt=excluded.excerpt
          and learning_radar.story_sources.published_at=excluded.published_at and learning_radar.story_sources.is_primary=excluded.is_primary
          and learning_radar.story_sources.verification_state='verified' returning story_id`,
      [storyId,rawId,source.name,source.url,brief.title,brief.whatHappened,sourceAt,sourceIndex===0,publication.asOf,sourceHost,domain,officialSource(source)],'learning_source')
    }
    const updateId=id('gitlu',publication.snapshotId,brief.id);const body=[brief.mechanism,brief.workedExample,...brief.risksAndLimits,...brief.nextQuestions].join('\n')
    await exactInsert(sql,`insert into learning_radar.story_updates (id,story_id,title_zh,body_zh,occurred_at)
      values ($1,$2,'机制、示例与边界',$3,$4)
      on conflict (id) do update set id=excluded.id where learning_radar.story_updates.story_id=excluded.story_id
        and learning_radar.story_updates.title_zh=excluded.title_zh and learning_radar.story_updates.body_zh=excluded.body_zh
        and learning_radar.story_updates.occurred_at=excluded.occurred_at returning id`,[updateId,storyId,body,publication.asOf],'learning_update')
  }
}

export async function materializeRadarPublication(sql,kind,publication){
  if(publication?.origin!=='research'||publication?.publicationState!=='published')throw new Error('Only published research may be materialized')
  if(kind==='market')return materializeMarket(sql,publication)
  if(kind==='learning')return materializeLearning(sql,publication)
  throw new Error(`Unsupported radar kind: ${kind}`)
}
