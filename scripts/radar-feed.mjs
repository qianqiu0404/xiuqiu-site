// Flattens published Learning Radar editions into a brief-level feed and
// renders the public subscription outputs (RSS, JSON Feed, llms.txt).

import { escapeXml, SITE_URL } from '../shared/site.ts'

export { SITE_URL }
const SUMMARY_LIMIT = 120
const FEED_ITEM_LIMIT = 60

function truncate(value, limit = SUMMARY_LIMIT) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function legacyItem(radar, key, domain, topic, anchor, item, index = 0) {
  if (!item) return undefined
  return {
    id: `${radar.slug}-${key}${index ? `-${index}` : ''}`,
    date: radar.date,
    domain,
    topic,
    title: item.title,
    summary: truncate(item.summary),
    anchor,
    sourceUrl: item.sourceUrl,
  }
}

export function buildRadarFeedItems(radars) {
  return radars.flatMap((radar) => {
    if (radar.schemaVersion === 2 && Array.isArray(radar.briefs)) {
      return radar.briefs.map((brief) => {
        const source = brief.sources?.[0]
        return {
          id: brief.id,
          date: radar.date,
          domain: brief.domain,
          topic: brief.topic,
          title: brief.title,
          summary: truncate(brief.whyItMatters),
          anchor: brief.id,
          sourceName: source?.name,
          sourceTier: source?.tier,
          sourceUrl: source?.url,
          ...(radar.deepDive?.basedOnBriefId === brief.id ? { isDeepDive: true } : {}),
        }
      })
    }
    return [
      ...radar.marketSignals.map((signal, index) => legacyItem(radar, 'signal', 'web3', 'market_signal', 'industry-signals', signal, index)),
      legacyItem(radar, 'ai', 'ai', 'ai_engineering', 'ai-engineering', radar.aiTip),
      legacyItem(radar, 'web3', 'web3', 'web3_design', 'web3-design', radar.web3Design),
      legacyItem(radar, 'tools', 'ai', 'tools', 'tools', radar.vibeProject),
      legacyItem(radar, 'reading', 'ai', 'reading', 'reading', radar.readingPick),
    ].filter(Boolean)
  })
}

function itemUrl(item) {
  return `${SITE_URL}/radar/${item.date}#${item.anchor}`
}

function rfc822(date) {
  // Editions publish at 08:00 Asia/Shanghai.
  return new Date(`${date}T08:00:00+08:00`).toUTCString()
}

export function buildRss(items) {
  const entries = items.slice(0, FEED_ITEM_LIMIT).map(item => [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(itemUrl(item))}</link>`,
    `      <guid isPermaLink="false">${escapeXml(`xiuqiu-radar:${item.id}`)}</guid>`,
    `      <pubDate>${rfc822(item.date)}</pubDate>`,
    `      <category>${escapeXml(item.domain.toUpperCase())}</category>`,
    `      <category>${escapeXml(item.topic)}</category>`,
    `      <description>${escapeXml(item.summary)}</description>`,
    '    </item>',
  ].join('\n'))
  const lastBuild = items[0] ? `\n    <lastBuildDate>${rfc822(items[0].date)}</lastBuildDate>` : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>xiuqiu 学习雷达 · AI 与 Web3</title>
    <link>${SITE_URL}/radar</link>
    <atom:link href="${SITE_URL}/radar/rss.xml" rel="self" type="application/rss+xml" />
    <description>每天 2 条 AI、2 条 Web3 工程简报：先讲机制，再给例子和边界。</description>
    <language>zh-CN</language>${lastBuild}
${entries.join('\n')}
  </channel>
</rss>
`
}

export function buildJsonFeed(items) {
  return `${JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'xiuqiu 学习雷达 · AI 与 Web3',
    home_page_url: `${SITE_URL}/radar`,
    feed_url: `${SITE_URL}/radar/feed.json`,
    language: 'zh-CN',
    items: items.slice(0, FEED_ITEM_LIMIT).map(item => ({
      id: `xiuqiu-radar:${item.id}`,
      url: itemUrl(item),
      title: item.title,
      summary: item.summary,
      content_text: item.summary,
      date_published: new Date(`${item.date}T08:00:00+08:00`).toISOString(),
      tags: [item.domain, item.topic],
      ...(item.sourceUrl ? { external_url: item.sourceUrl } : {}),
    })),
  }, null, 2)}\n`
}

export function buildLlmsTxt(items) {
  const recent = items.slice(0, 12).map(item => `- [${item.title}](${itemUrl(item)}) (${item.date}, ${item.domain}/${item.topic}): ${item.summary}`)
  return `# xiuqiu-site

> Qiu Market、Wallet Infrastructure 学习方向与 AI Engineering 交付证据的公开入口。学习雷达每天整理 AI 与 Web3 工程简报。

## Learning Radar

- [信息流](${SITE_URL}/radar): 按日期、领域与主题浏览全部公开简报
- [RSS](${SITE_URL}/radar/rss.xml)
- [JSON Feed](${SITE_URL}/radar/feed.json)

## Recent briefs

${recent.join('\n')}

## Boundaries

- 内容由公开来源经 AI 自动汇总，周度判断另行人工复核；不构成投资建议。
`
}
