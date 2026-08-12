export async function cleanupLearningRetention(client) {
  const purged = await client.query(`update learning_radar.raw_items
    set payload_fingerprint = coalesce(payload_fingerprint, md5(payload::text)),
      payload = '{"retained":false}'::jsonb,
      payload_purged_at = now()
    where payload_expires_at < now() and payload_purged_at is null returning id`)
  const removedRuns = await client.query(`delete from learning_radar.job_runs
    where started_at < now() - interval '30 days' returning id`)
  return { purgedPayloads: purged.rows.length, removedRuns: removedRuns.rows.length }
}
