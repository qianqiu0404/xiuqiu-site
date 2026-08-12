export async function publishRadarSnapshot(sql, kind, publication, sourceRevision) {
  if (!['learning', 'market'].includes(kind)) throw new Error(`Unsupported radar kind: ${kind}`)
  if (!publication || publication.origin !== 'research' || publication.publicationState !== 'published') {
    throw new Error('Only published research snapshots may enter the publication store.')
  }
  if (!/^[0-9a-f]{40}$/.test(sourceRevision || '')) {
    throw new Error('Radar snapshot source revision must be an exact lowercase Git SHA.')
  }
  const inserted = await sql.query(`insert into radar_system.publication_snapshots
    (snapshot_id, radar_kind, as_of, origin, publication_state, payload_checksum, payload, source_revision, published_at)
    values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,now())
    on conflict (snapshot_id) do nothing
    returning snapshot_id`, [
    publication.snapshotId, kind, publication.asOf, publication.origin, publication.publicationState,
    publication.payloadChecksum, JSON.stringify(publication.payload), sourceRevision,
  ])
  if ((inserted.rowCount ?? inserted.length ?? 0) === 1) return { inserted: true, snapshotId: publication.snapshotId }
  const existingResult = await sql.query(`select snapshot_id
    from radar_system.publication_snapshots
    where snapshot_id = $1 and radar_kind = $2 and as_of = $3::timestamptz and origin = $4
      and publication_state = $5 and payload_checksum = $6 and payload = $7::jsonb
      and source_revision is not distinct from $8`, [
    publication.snapshotId, kind, publication.asOf, publication.origin, publication.publicationState,
    publication.payloadChecksum, JSON.stringify(publication.payload), sourceRevision,
  ])
  const existing = Array.isArray(existingResult) ? existingResult[0] : existingResult.rows?.[0]
  if (!existing) throw new Error('radar_snapshot_content_conflict')
  return { inserted: false, snapshotId: publication.snapshotId }
}
