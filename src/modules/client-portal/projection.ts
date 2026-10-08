import {clientDeliverables} from '../deliverables/types.ts';
import type {Deliverable} from '../deliverables/types.ts';
import type {Progress, ProjectFile, ProjectMessage} from '../project-collaboration/queries.ts';

export type PortalFile = Pick<ProjectFile, 'id' | 'version' | 'name' | 'state' | 'audience' | 'drive_url'>;
export type PortalMessage = Pick<ProjectMessage, 'id' | 'audience' | 'body' | 'created_at' | 'author'>;

// This is a publication boundary, not authorization. Callers must authorize the
// business/project before loading data. Never serialize staff query results.
export function projectPortalContent(input: {
  published: Progress | null;
  files: ProjectFile[];
  messages: ProjectMessage[];
  deliverables: Deliverable[];
}) {
  const files: PortalFile[] = input.files
    .filter(file => file.audience === 'client' && file.state === 'ready')
    .map(file => ({id: file.id, version: file.version, name: file.name,
      state: file.state, audience: file.audience, drive_url: file.drive_url}));
  const sharedIds = new Set(files.map(file => file.id));
  const messages: PortalMessage[] = input.messages
    .filter(message => message.audience === 'client')
    .map(message => ({id: message.id, audience: message.audience, body: message.body,
      created_at: message.created_at,
      author: message.author ? {display_name: message.author.display_name} : undefined}));
  const progress: Progress | null = input.published ? {
    revision: input.published.revision,
    current_work: input.published.current_work,
    next_action: input.published.next_action,
    milestones: input.published.milestones.map(milestone => ({title: milestone.title, status: milestone.status})),
  } : null;
  const deliverables = clientDeliverables(input.deliverables).map(deliverable => ({
    ...deliverable,
    versions: deliverable.versions.map(version => ({...version,
      file_ids: version.file_ids.filter(id => sharedIds.has(id))})),
  }));
  return {progress, files, messages, deliverables};
}
