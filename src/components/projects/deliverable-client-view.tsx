import type {ClientDeliverable} from '@/modules/deliverables/types';
import type {PortalFile} from '@/modules/client-portal/projection';
export function DeliverableClientView({deliverables,files,practice=false}:{deliverables:ClientDeliverable[];files:PortalFile[];practice?:boolean}) {
  if(!deliverables.length) return <p className="mt-3 text-slate-600">No deliverables published for review yet.</p>;
  return <div className="mt-4 space-y-5">{deliverables.map(d=><article key={d.id} className="rounded-xl border border-slate-200 p-4">
    <h3 className="font-medium">{d.title}</h3>
    {d.versions.map((v,index)=><div key={v.id} className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-sm font-medium">Version {v.version}{index===0?' · Latest published':' · Earlier version'}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{v.description}</p>
      <ul className="mt-3 space-y-2 text-sm">{v.file_ids.map(id=>{
        const file=files.find(f=>f.id===id&&f.state==='ready'&&f.audience==='client');
        return <li key={id}>{file?(practice?<span>{file.name} · File version {file.version} (practice)</span>:<a href={`/api/v1/project-files/${file.id}`} className="underline">{file.name} · File version {file.version}</a>):'Attachment is currently unavailable; ask your team.'}</li>;
      })}</ul>
      <p className="mt-3 text-sm">{v.outcome==='approved'?'Client response recorded: Approved':v.outcome==='changes_requested'?'Client response recorded: Changes requested':'Awaiting client response'}</p>
      {v.feedback?<p className="mt-2 whitespace-pre-wrap text-sm">{v.feedback}</p>:null}
    </div>)}
  </article>)}</div>;
}
