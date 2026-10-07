import { z } from "zod";
import { requireActiveIdentity, requireAdminIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { callIdempotentDomainRpc, type DomainActionSource } from "@/modules/domain/action-rpc";

export const requestSchema = z.object({
  kind: z.enum(["feature", "bug"]), title: z.string().trim().min(1).max(200),
  details: z.string().trim().min(1).max(10000), impact: z.enum(["normal", "blocking"]).default("normal"),
  page: z.string().trim().max(500).nullable().optional(),
});
export const messageSchema = z.object({
  recipientId: z.string().uuid(), subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000), context: z.string().trim().max(10000).nullable().optional(),
  replyToId: z.string().uuid().nullable().optional(),
});
export async function submitRequest(requestKey: string, input: z.input<typeof requestSchema>, source: DomainActionSource = "site_tools") {
  return callIdempotentDomainRpc<{id:string;ownerId:string;status:string}>({functionName:"kp_submit_request",source,requestKey,payload:requestSchema.parse(input)});
}
export async function sendChatMessage(requestKey: string, input: z.input<typeof messageSchema>, source: DomainActionSource = "site_tools") {
  return callIdempotentDomainRpc<{id:string;status:string}>({functionName:"kp_send_chat_message",source,requestKey,payload:messageSchema.parse(input)});
}
export type ChatMessage = {
  id:string;sender_id:string;recipient_id:string;subject:string;body:string;context:string|null;
  reply_to_id:string|null;created_at:string;acknowledged_at:string|null;source:string;
  sender:{id:string;display_name:string|null};recipient:{id:string;display_name:string|null};
};
export async function listChatMessages(pendingOnly = false) {
  const {user} = await requireActiveIdentity();
  const supabase = await createClient();
  let query = supabase.from("chat_messages").select("id,sender_id,recipient_id,subject,body,context,reply_to_id,created_at,acknowledged_at,source,sender:profiles!sender_id(id,display_name),recipient:profiles!recipient_id(id,display_name)")
    .order("created_at",{ascending:false});
  if (pendingOnly) query=query.eq("recipient_id",user.id).is("acknowledged_at",null);
  const {data,error}=await query;
  if(error) throw new Error(error.message);
  return (data??[]) as unknown as ChatMessage[];
}
export async function listChatRecipients() {
  const {user}=await requireActiveIdentity(); const supabase=await createClient();
  const {data,error}=await supabase.from("profiles").select("id,display_name").eq("status","active").neq("id",user.id).order("display_name");
  if(error) throw new Error(error.message); return data??[];
}
export async function acknowledgeChatMessage(id:string) {
  const {user}=await requireActiveIdentity(); const supabase=await createClient();
  const {data,error}=await supabase.from("chat_messages").update({acknowledged_at:new Date().toISOString()})
    .eq("id",z.string().uuid().parse(id)).eq("recipient_id",user.id).select("id,acknowledged_at").maybeSingle();
  if(error) throw new Error(error.message); if(!data) throw new Error("Incoming message not found."); return data;
}
export async function reviewRequest(id:string,recommendation:string) {
  await requireAdminIdentity(); const supabase=await createClient();
  const {data,error}=await supabase.from("decisions").update({assistant_recommendation:z.string().trim().min(1).max(10000).parse(recommendation),recommendation_reviewed_at:new Date().toISOString()})
    .eq("id",z.string().uuid().parse(id)).not("request_kind","is",null).select("id,assistant_recommendation,recommendation_reviewed_at").maybeSingle();
  if(error) throw new Error(error.message); if(!data) throw new Error("Request decision not found."); return data;
}
