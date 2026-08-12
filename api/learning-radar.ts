import { createLearningRadarHandler } from '../lib/learning-radar/http-handlers.js'
import {
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
} from '../lib/market-radar/http.js'
import { parseLearningRadarCursor } from '../src/learning-radar/contracts.js'
import { fetchRadarUpstream, isRadarUpstreamConfigured } from '../lib/radar-upstream.js'

const active = {
  getSummary: () => isRadarUpstreamConfigured() ? fetchRadarUpstream('/v1/learning-radar/summary') : Promise.reject(new Error('radar_upstream_unconfigured')),
  listItems: (query: { category?: string; cursor?: string; windowHours: number; limit: number }) => {
    if (!isRadarUpstreamConfigured()) return Promise.reject(new Error('radar_upstream_unconfigured'))
    const target=new URL('/v1/learning-radar/items','https://radar.invalid')
    for(const [key,value] of Object.entries({category:query.category,cursor:query.cursor,window:String(query.windowHours),limit:String(query.limit)})) if(value) target.searchParams.set(key,String(value))
    return fetchRadarUpstream(`${target.pathname}${target.search}`)
  },
  listDigests: (limit: number) => isRadarUpstreamConfigured() ? fetchRadarUpstream(`/v1/learning-radar/digests?limit=${limit}`) : Promise.reject(new Error('radar_upstream_unconfigured')),
  getStory: (id: string) => isRadarUpstreamConfigured() ? fetchRadarUpstream(`/v1/learning-radar/stories/${encodeURIComponent(id)}`,fetch,{notFoundAsNull:true}) : Promise.reject(new Error('radar_upstream_unconfigured')),
}

export default createLearningRadarHandler({
  ...active,
  parseCursor: parseLearningRadarCursor,
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
})
