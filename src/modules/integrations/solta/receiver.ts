import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const readRequest=z.object({version:z.literal(1),operation:z.literal('project.read'),business:z.literal('solta'),projectId:z.uuid(),organizationId:z.uuid(),portalProjectId:z.uuid(),actorId:z.string().min(1).max(100)}).strict();
export type ReadRequest=z.infer<typeof readRequest>;
export type ReadConfig={enabled?:string;secret?:string;databaseUrl?:string;databaseSecret?:string};
export async function receiveSoltaRead(request:Request,config:ReadConfig,read:(input:ReadRequest,nonce:string)=>Promise<unknown>,now=Date.now()){
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(config.enabled!=='true'||!config.secret||config.secret.length<32||!config.databaseUrl||!config.databaseSecret)return reply({error:'Connection inactive'},503);
 const timestamp=request.headers.get('x-solta-timestamp')||'',nonce=request.headers.get('x-solta-nonce')||'',signature=request.headers.get('x-solta-signature')||'';
 if(!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!z.uuid().safeParse(nonce).success||!/^[a-f0-9]{64}$/.test(signature))return reply({error:'Unauthorized'},401);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({error:'JSON required'},415);
 const reader=request.body?.getReader();if(!reader)return reply({error:'Invalid request'},400);
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply({error:'Request too large'},413);}chunks.push(value);}}catch{return reply({error:'Invalid request'},400);}finally{reader.releaseLock();}
 const raw=Buffer.concat(chunks);
 const expected=createHmac('sha256',config.secret).update(timestamp+'.'+nonce+'.').update(raw).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))return reply({error:'Unauthorized'},401);
 let input;try{input=readRequest.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));}catch{return reply({error:'Invalid request'},400);}
 try{const result=await read(input,nonce);return result?reply(result):reply({error:'Project not found'},404);}catch{return reply({error:'Connection temporarily unavailable'},503);}
}
