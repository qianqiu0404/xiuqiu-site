export const publicLearningTimelineRow = {
  id: 'learning-story-1',
  slug: '2026-08-11-postgresql-advisory-locks',
  category: 'engineering_tools',
  importance: 'noteworthy',
  title_zh: 'PostgreSQL 会话锁需要固定连接',
  summary_zh: '会话级 advisory lock 不能跨无状态 HTTP 查询维持。',
  why_selected_zh: '这会直接影响迁移与抓取任务的互斥可靠性。',
  occurred_at: '2026-08-11T01:00:00.000Z',
  published_at: '2026-08-11T01:20:00.000Z',
  source_count: 1,
  primary_source: {
    name: 'PostgreSQL Documentation',
    url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
    publishedAt: '2026-08-11T01:00:00.000Z',
  },
}

export const publicLearningReportRow = {
  id: 'learning-report-1',
  story_id: publicLearningTimelineRow.id,
  source_name: 'PostgreSQL Documentation',
  source_url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
  title: 'Explicit Locking',
  excerpt: 'Advisory locks can be acquired at session or transaction level.',
  published_at: '2026-08-11T01:00:00.000Z',
  is_primary: true,
}

export const publicLearningUpdateRow = {
  id: 'learning-update-1',
  story_id: publicLearningTimelineRow.id,
  title_zh: '补充固定连接边界',
  body_zh: '同一连接负责获取和释放会话锁，业务查询可以使用既有客户端。',
  occurred_at: '2026-08-11T02:00:00.000Z',
}
