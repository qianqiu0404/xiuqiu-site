import records from './records.json'
import type { ResumeProject } from './presentation'

export const projects: ResumeProject[] = records
export { filterResumeProjects, normalizeCategory, projectIdFromHash, adjacentProjectId, resumeSeo } from './presentation'

// Only the reviewed public summaries are bundled. The private knowledge map's
// application, notes and source material are not part of this feature.
export async function loadProjectNotes(): Promise<Record<string, string>> {
  return (await import('./notes.json')).default
}
