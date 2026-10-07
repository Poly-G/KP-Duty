import {randomUUID} from 'node:crypto';
import {ActionForm} from '@/components/action-form';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {getDeliverables,getDeliverableReviewers} from '@/modules/deliverables/queries';
import {deliverableKinds} from '@/modules/deliverables/types';
import {createDeliverable,addDeliverableVersion,reviewDeliverable,publishDeliverable} from '@/modules/deliverables/actions';
import {getProjectCollaboration} from '@/modules/project-collaboration/queries';
const field='rounded-lg border border-[var(--border)] p-3';
const button='rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40';
export async function ProjectDeliverables({id,business,ownerId,requirements}:{id:string;business:string;ownerId:string;requirements:Record<string,string>}) {
  const [deliverables,reviewers,collaboration,{profile}]=await Promise.all([
    getDeliverables(id),getDeliverableReviewers(),getProjectCollaboration(id),requireActiveIdentity(),
  ]);
  const availableFiles=collaboration.files.filter(f=>f.state==='ready'&&!f.drive_url);
  function context(){return <><input type="hidden" name="project_id" value={id}/><input type="hidden" name="business" value={business}/></>;}
  return <section className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="text-xl font-medium">Deliverables & approvals</h2>
    <p className="mt-2 text-sm text-[var(--muted)]">Review one saved version at a time. A new version needs a fresh review. Approval does not start delivery or launch the project.</p>
    <ActionForm action={createDeliverable} key={`create-${deliverables.length}`} className="mt-5 grid gap-3" errorMessage="Couldn’t create this deliverable. Check the fields and reviewer, then try again.">
      {context()}<input type="hidden" name="request_id" value={randomUUID()}/>
      <label className="grid gap-2 text-sm">Deliverable title<input required name="title" maxLength={200} className={field}/></label>
      <label className="grid gap-2 text-sm">Deliverable type<select name="kind" className={field}>{Object.entries(deliverableKinds).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label>
      {profile.role==='admin'?<label className="grid gap-2 text-sm">Internal reviewer<select name="reviewer_id" defaultValue={ownerId} className={field}>{reviewers.map(r=><option key={r.id} value={r.id}>{r.display_name||'Team member'}</option>)}</select></label>:<><input type="hidden" name="reviewer_id" value={ownerId}/><p className="text-sm text-[var(--muted)]">The project owner reviews internally. An admin can assign a different reviewer.</p></>}
      <label className="grid gap-2 text-sm">Related onboarding requirement<select name="requirement_key" className={field}><option value="">No requirement link</option>{Object.entries(requirements).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <button type="submit" className={button}>Create deliverable</button>
    </ActionForm>
    <div className="mt-6 space-y-6">{deliverables.map(d=>{
      const current=d.versions.find(v=>v.version===d.current_version);
      const internal=current?.reviews.find(r=>r.lane==='internal');
      const client=current?.reviews.find(r=>r.lane==='client_record');
      const canReview=profile.role==='admin'||profile.id===d.reviewer_id;
      return <article key={d.id} className="rounded-xl border border-[var(--border)] p-4">
        <h3 className="font-medium">{d.title}</h3><p className="mt-2 text-xs text-[var(--muted)]">{deliverableKinds[d.kind]} · Reviewer: {d.reviewer?.display_name||'Team member'}{d.requirement_key?` · Requirement: ${requirements[d.requirement_key]||d.requirement_key}`:''}</p>
        <p className="mt-3 text-sm">{current?`Current version ${current.version} · ${internal?.outcome==='approved'?'Internally approved':internal?.outcome==='changes_requested'?'Changes requested':'Awaiting internal review'}${client?` · Client response: ${client.outcome==='approved'?'Approved':'Changes requested'}`:''}`:'No version saved yet.'}</p>
        <ActionForm key={`version-${d.current_version}`} action={addDeliverableVersion} className="mt-4 grid gap-3" errorMessage="Couldn’t save this version. Use ready uploaded files from this project. If another teammate saved a version, reload and try again.">
          {context()}<input type="hidden" name="deliverable_id" value={d.id}/><input type="hidden" name="expected_version" value={d.current_version}/><input type="hidden" name="request_id" value={randomUUID()}/>
          <label className="grid gap-2 text-sm">Version summary for {d.title} · shown when published<textarea required name="description" maxLength={10000} rows={3} className={field}/></label>
          <fieldset className="space-y-2"><legend className="mb-2 text-sm">Attach exact file versions · up to 20</legend>{availableFiles.map(f=><label key={f.id} className="flex gap-2 text-sm"><input type="checkbox" name="file_ids" value={f.id}/>{f.name} · File version {f.version}</label>)}</fieldset>
          <p className="text-xs text-[var(--muted)]">Drive contents can change outside KP. Upload a fixed export for an approval attachment. Text-only versions can be reviewed without a file.</p>
          <button type="submit" className={button}>Save new version of {d.title}</button>
        </ActionForm>
        {current&&!internal&&canReview?<ActionForm action={reviewDeliverable} key={`internal-${current.id}`} className="mt-5 grid gap-3" errorMessage="Couldn’t record this review. Only the assigned reviewer or an admin can review the current version. Reload if it changed.">
          {context()}<input type="hidden" name="request_id" value={randomUUID()}/><input type="hidden" name="version_id" value={current.id}/><input type="hidden" name="lane" value="internal"/>
          <label className="grid gap-2 text-sm">Internal outcome for {d.title} · Version {current.version}<select name="outcome" className={field}><option value="approved">Approve</option><option value="changes_requested">Request changes</option></select></label>
          <label className="grid gap-2 text-sm">Internal review note<textarea required name="note" maxLength={5000} rows={2} className={field}/></label>
          <button type="submit" className={button}>Record internal review of version {current.version}</button>
        </ActionForm>:null}
        {current&&!current.published_at?<ActionForm action={publishDeliverable} className="mt-4" errorMessage="Couldn’t publish this version. It needs internal approval and must still be the current version.">
          {context()}<input type="hidden" name="version_id" value={current.id}/><button type="submit" disabled={internal?.outcome!=='approved'} className={button}>Publish version {current.version} and share its attached files</button>
        </ActionForm>:null}
        {current?.published_at&&!client?<ActionForm action={reviewDeliverable} key={`client-${current.id}`} className="mt-5 grid gap-3" errorMessage="Couldn’t record this client response. Include the client’s name and evidence, and review the latest published version.">
          {context()}<input type="hidden" name="request_id" value={randomUUID()}/><input type="hidden" name="version_id" value={current.id}/><input type="hidden" name="lane" value="client_record"/>
          <h4 className="text-sm font-medium">Record client response from email or a meeting</h4><p className="text-xs text-[var(--muted)]">Record an actual response with its evidence. Direct client review in the portal will come with client login later.</p>
          <label className="grid gap-2 text-sm">Client name<input required name="client_name" maxLength={200} className={field}/></label>
          <label className="grid gap-2 text-sm">Client outcome for {d.title} · Version {current.version}<select name="outcome" className={field}><option value="approved">Approved</option><option value="changes_requested">Changes requested</option></select></label>
          <label className="grid gap-2 text-sm">Client feedback · visible in portal<textarea required name="note" maxLength={5000} rows={2} className={field}/></label>
          <label className="grid gap-2 text-sm">Evidence · internal only<textarea required name="evidence" maxLength={5000} rows={2} placeholder="Email reference, meeting date and response, or evidence link" className={field}/></label>
          <button type="submit" className={button}>Record client response to version {current.version}</button>
        </ActionForm>:null}
        <details className="mt-5"><summary className="cursor-pointer text-sm">Versions & review history</summary><div className="mt-3 space-y-4">{d.versions.map(v=><section key={v.id} className="rounded-lg bg-[var(--surface-subtle)] p-3">
          <h4 className="text-sm font-medium">Version {v.version} · {v.published_at?'Published':'Internal only'}</h4><p className="mt-2 whitespace-pre-wrap text-sm">{v.description}</p>
          <ul className="mt-2 space-y-1 text-sm">{v.file_ids.map(fileId=>{const file=collaboration.files.find(f=>f.id===fileId);return <li key={fileId}>{file?<a href={`/api/v1/project-files/${file.id}`} className="underline">{file.name} · File version {file.version}</a>:<span>Retained file reference: {fileId}</span>}</li>;})}</ul>
          {v.reviews.map(r=><div key={r.id} className="mt-3 border-t border-[var(--border)] pt-3 text-sm"><p>{r.lane==='internal'?'Internal review':'Client response recorded'}: {r.outcome==='approved'?'Approved':'Changes requested'} · {r.actor?.display_name||'Team member'} · {new Date(r.recorded_at).toLocaleDateString('en-US',{timeZone:'UTC'})}</p><p className="mt-1 whitespace-pre-wrap">{r.note}</p>{r.lane==='client_record'?<><p className="mt-1">Client: {r.client_name}</p><p className="mt-1 whitespace-pre-wrap">Evidence: {r.evidence}</p></>:null}</div>)}
        </section>)}</div></details>
      </article>;
    })}</div>
  </section>;
}
