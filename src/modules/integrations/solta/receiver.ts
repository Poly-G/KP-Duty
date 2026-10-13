import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {MAX_FILE_BYTES,PROJECT_FILE_MIME_TYPES} from '../../project-collaboration/files.ts';
export const readRequest=z.object({version:z.literal(1),operation:z.literal('project.read'),business:z.literal('solta'),projectId:z.uuid(),organizationId:z.uuid(),portalProjectId:z.uuid(),actorId:z.string().min(1).max(100)}).strict();
const base=readRequest.omit({operation:true}).extend({actorName:z.string().trim().min(1).max(100),actorRole:z.enum(['member','approver'])});
export const portalRequest=z.union([readRequest,
 base.extend({operation:z.literal('message.create'),payload:z.object({requestId:z.uuid(),body:z.string().trim().min(1).max(10000)}).strict()}).strict(),
 base.extend({operation:z.literal('file.reserve'),payload:z.object({requestId:z.uuid(),name:z.string().regex(/^[a-zA-Z0-9._-]{1,180}$/).refine(n=>n!=='.'&&n!=='..'),size:z.number().int().min(1).max(MAX_FILE_BYTES),mime:z.enum(PROJECT_FILE_MIME_TYPES),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()}).strict(),
 base.extend({operation:z.enum(['file.complete','file.download']),payload:z.object({fileId:z.uuid()}).strict()}).strict(),
 base.extend({operation:z.literal('scope.decide'),payload:z.object({requestId:z.uuid(),scopeId:z.uuid(),version:z.number().int().positive(),outcome:z.enum(['approved','changes_requested']),note:z.string().trim().max(5000),confirmed:z.boolean()}).strict().refine(p=>p.outcome!=='changes_requested'||p.note.length>0)}).strict(),
 base.extend({operation:z.literal('review.decide'),payload:z.object({requestId:z.uuid(),reviewId:z.uuid(),version:z.number().int().positive(),outcome:z.enum(['approved','changes_requested']),note:z.string().trim().max(5000),confirmed:z.boolean()}).strict().refine(p=>p.outcome!=='changes_requested'||p.note.length>0)}).strict(),
]);
export type ReadRequest=z.infer<typeof portalRequest>;
export class ReceiverError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export type ReadConfig={enabled?:string;secret?:string;databaseUrl?:string;databaseSecret?:string};
export async function receiveSoltaRead(request:Request,config:ReadConfig,read:(input:ReadRequest,nonce:string)=>Promise<unknown>,now=Date.now()){
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(config.enabled!=='true'||!config.secret||config.secret.length<32||!config.databaseUrl||!config.databaseSecret)return reply({error:'Connection inactive'},503);
 const timestamp=request.headers.get('x-solta-timestamp')||'',nonce=request.headers.get('x-solta-nonce')||'',signature=request.headers.get('x-solta-signature')||'';
 const metadataError=!/^\d{10}$/.test(timestamp)?'TIMESTAMP_FORMAT':Math.abs(now/1000-Number(timestamp))>300?'TIMESTAMP_EXPIRED':!z.uuid().safeParse(nonce).success?'NONCE_FORMAT':!/^[a-f0-9]{64}$/.test(signature)?'SIGNATURE_FORMAT':undefined;
 if(metadataError){console.error('Solta receiver authentication failed',metadataError);return reply({error:'Unauthorized'},401);}
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({error:'JSON required'},415);
 const reader=request.body?.getReader();if(!reader)return reply({error:'Invalid request'},400);
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return reply({error:'Request too large'},413);}chunks.push(value);}}catch{return reply({error:'Invalid request'},400);}finally{reader.releaseLock();}
 const raw=Buffer.concat(chunks);
 const expected=createHmac('sha256',config.secret).update(timestamp+'.'+nonce+'.').update(raw).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'hex'))){console.error('Solta receiver authentication failed','SIGNATURE_MISMATCH');return reply({error:'Unauthorized'},401);}
 let input;try{input=portalRequest.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));}catch{return reply({error:'Invalid request'},400);}
 try{const result=await read(input,nonce);return result?reply(result):reply({error:'Project not found'},404);}catch(error){if(error instanceof ReceiverError)return reply({error:error.message},error.status);return reply({error:'Connection temporarily unavailable'},503);}
}
