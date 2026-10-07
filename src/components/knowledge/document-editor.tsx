import {ActionForm} from "@/components/action-form";
import {saveKnowledgeForm} from "@/modules/knowledge/actions";
import type {KnowledgeDocument} from "@/modules/knowledge/service";
export function DocumentEditor({document}:{document?:KnowledgeDocument}) {
 const field="mt-1 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm";
 return <ActionForm action={saveKnowledgeForm} className="space-y-4">
 <input type="hidden" name="id" value={document?.id??crypto.randomUUID()}/>
 <input type="hidden" name="revision" value={document?.revision??0}/>
 <label className="block">Title<input name="title" required maxLength={200} defaultValue={document?.title} className={field}/></label>
 <div className="grid gap-3 sm:grid-cols-2"><label>Category<select name="category" defaultValue={document?.category??"company"} className={field}><option value="company">Company</option><option value="sop">Process / SOP</option><option value="solta">Solta</option><option value="snd">SnD</option></select></label>
 <label>Status<select name="status" defaultValue={document?.status??"draft"} className={field}><option value="draft">Draft</option><option value="current">Current / approved</option><option value="historical">Historical</option></select></label></div>
 <label className="block">Guide<textarea name="content" required maxLength={2000000} rows={24} defaultValue={document?.content} className={field}/></label>
 <p className="text-sm text-[var(--muted)]">Headings, lists and links are supported. Previous versions are retained. Publishing a current guide records an approved company rule; keep proposals as drafts.</p>
 <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Save guide</button>
 </ActionForm>;
}
