"use server";
import { revalidatePath } from "next/cache";
import { acknowledgeChatMessage,sendChatMessage,submitRequest } from "./service";
export async function submitRequestForm(form:FormData) {
  await submitRequest(String(form.get("request_key")),{kind:form.get("kind") as "feature"|"bug",title:String(form.get("title")),details:String(form.get("details")),impact:form.get("impact") as "normal"|"blocking",page:String(form.get("page")??"")},"ui");
  revalidatePath("/requests");revalidatePath("/decisions");revalidatePath("/");
}
export async function sendMessageForm(form:FormData) {
  await sendChatMessage(String(form.get("request_key")),{recipientId:String(form.get("recipient_id")),subject:String(form.get("subject")),body:String(form.get("body")),context:String(form.get("context")??""),replyToId:form.get("reply_to_id") ? String(form.get("reply_to_id")):null},"ui");
  revalidatePath("/inbox");revalidatePath("/");
}
export async function acknowledgeMessageForm(form:FormData) {
  await acknowledgeChatMessage(String(form.get("message_id")));revalidatePath("/inbox");revalidatePath("/");
}
