import { ActionForm } from "@/components/action-form";
import { PageHeading } from "@/components/page-heading";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { acknowledgeMessageForm,sendMessageForm } from "@/modules/collaboration/actions";
import { listChatMessages,listChatRecipients } from "@/modules/collaboration/service";
export default async function InboxPage() {
 const [{user},messages,recipients]=await Promise.all([requireActiveIdentity(),listChatMessages(),listChatRecipients()]);
 const field="mt-2 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm";
 const pending=messages.filter(m=>m.recipient_id===user.id&&!m.acknowledged_at);
 return <><PageHeading eyebrow="Inbox" title="Messages between your chats" description="Send context or ask for clarification. Messages appear in the recipient’s next daily pull and stay pending until acknowledged."/>
 <details className="mb-6 rounded-xl border border-[var(--border)] p-4"><summary>New message</summary><ActionForm action={sendMessageForm} className="mt-4 space-y-3">
 <input type="hidden" name="request_key" value={crypto.randomUUID()}/>
 <label className="block">To<select name="recipient_id" required className={field}>{recipients.map(r=><option key={r.id} value={r.id}>{r.display_name}</option>)}</select></label>
 <label className="block">Subject<input name="subject" required maxLength={200} className={field}/></label>
 <label className="block">Message<textarea name="body" required maxLength={10000} rows={4} className={field}/></label>
 <label className="block">Context / what answer is needed<textarea name="context" maxLength={10000} rows={3} className={field}/></label>
 <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Send message</button></ActionForm></details>
 <h2 className="mb-3 font-semibold">{pending.length} pending for you</h2>
 {messages.length?messages.map(m=><article key={m.id} className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
 <p className="text-xs text-[var(--muted)]">{m.sender.display_name} → {m.recipient.display_name} · {new Date(m.created_at).toLocaleString("en-US",{timeZone:"America/Los_Angeles"})} · {m.acknowledged_at?"Acknowledged":"Pending"}{m.reply_to_id?" · Reply":""}</p>
 <h2 className="mt-2 font-semibold">{m.subject}</h2><p className="mt-3 whitespace-pre-wrap text-sm">{m.body}</p>{m.context?<p className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">Context: {m.context}</p>:null}
 {m.recipient_id===user.id?<div className="mt-4 space-y-3">{!m.acknowledged_at?<ActionForm action={acknowledgeMessageForm}><input type="hidden" name="message_id" value={m.id}/><button className="rounded-lg border px-3 py-2 text-sm">Acknowledge</button></ActionForm>:null}
 <details><summary className="text-sm">Reply with clarification or input</summary><ActionForm action={sendMessageForm} className="mt-3 space-y-3"><input type="hidden" name="request_key" value={crypto.randomUUID()}/><input type="hidden" name="reply_to_id" value={m.id}/><input type="hidden" name="recipient_id" value={m.sender_id}/><input type="hidden" name="subject" value={m.subject}/><input type="hidden" name="context" value={m.body}/><label className="block">Reply<textarea name="body" required maxLength={10000} rows={3} className={field}/></label><button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Send reply</button></ActionForm></details></div>:null}</article>):<p>No messages yet.</p>}</>;
}
