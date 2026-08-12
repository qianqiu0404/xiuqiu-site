export async function publishRadarSnapshot(sql, kind, publication, sourceRevision = process.env.GITHUB_SHA || null) {
  if (!['learning', 'market'].includes(kind)) throw new Error(`Unsupported radar kind: ${kind}`)
  if (!publication || publication.origin !== 'research' || publication.publicationState !== 'published') {
    throw new Error('Only published research snapshots may enter the publication store.')
  }
  await sql.query(`insert into radar_system.publication_snapshots
    (snapshot_id, radar_kind, as_of, origin, publication_state, payload_checksum, payload, source_revision, published_at)
    values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,now())
    on conflict (snapshot_id) do update set
      source_revision = coalesce(excluded.source_revision, radar_system.publication_snapshots.source_revision)`, [
    publication.snapshotId, kind, publication.asOf, publication.origin, publication.publicationState,
    publication.payloadChecksum, JSON.stringify(publication.payload), sourceRevision,
  ])
}
