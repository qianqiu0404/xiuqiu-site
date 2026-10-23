// UI model only. Existing generated Radar types and public outputs stay intact.
export type ReadingDomain = 'ai' | 'web3' | 'market' | 'review' | 'research'
export interface ResearchMaterial {
  id: string
  title: string
  url: string
  source_url: string | null
  source_type: string
  source_access: string
}
export interface ResearchCard {
  id: string
  kind: 'capture' | 'event' | 'daily_brief' | 'weekly_brief'
  title: string
  summary: string
  category: string
  date: string
  date_basis: 'event' | 'published' | 'collected' | 'brief'
  collected_at: string | null
  published_at: string | null
  event_date: string | null
  updated_at: string | null
  evidence_status: string
  url: string
  materials: ResearchMaterial[]
  topic_ids: string[]
  coverage: string | null
}
export interface ResearchIndex {
  schema_version: 1
  source: { name: string; home_url: string; revision: string }
  updated_at: string | null
  record_count: number
  cards: ResearchCard[]
  briefs: ResearchCard[]
}
export type ResearchNode = { text: string } | {
  tag: string
  children: ResearchNode[]
  href?: string
  record_id?: string
}
export interface ResearchDetail { schema_version: 1; record: ResearchCard; content: ResearchNode[] }
export interface ReadingItem {
  id: string
  kind: 'learning' | 'market' | 'review' | 'research'
  date: string
  domain: ReadingDomain
  topic: string
  title: string
  summary: string
  href: string
  source?: { name: string; tier?: 'tier1' | 'tier2'; url: string }
  flags?: { deepDive?: true; priority?: 'P0' | 'P1' | 'P2' }
  research?: ResearchCard
}
export interface ReadingTopic { topic: string; domain: ReadingDomain; count: number; firstSeen: string; lastSeen: string }
