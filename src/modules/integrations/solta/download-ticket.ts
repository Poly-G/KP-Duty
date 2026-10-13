import {createHmac,timingSafeEqual} from 'node:crypto';
import {portalRequest,type ReadRequest} from './receiver.ts';
export function downloadTicket(input:ReadRequest,secret:string,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({input,expires:Math.floor(now/1000)+60})).toString('base64url');
 const signature=createHmac('sha256',secret).update('solta-drive-download:v1.'+payload).digest('hex');return payload+'.'+signature;
}
export function verifyDownloadTicket(value:string,secret:string,now=Date.now()){
 if(secret.length<32||value.length>8000)throw new Error('Invalid ticket');const [payload,signature,...rest]=value.split('.');
 if(rest.length||!payload||! /^[a-f0-9]{64}$/.test(signature||''))throw new Error('Invalid ticket');
 const expected=createHmac('sha256',secret).update('solta-drive-download:v1.'+payload).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw new Error('Invalid ticket');
 const data=JSON.parse(Buffer.from(payload,'base64url').toString()),seconds=Math.floor(now/1000);
 if(!Number.isInteger(data.expires)||data.expires<=seconds||data.expires>seconds+60)throw new Error('Expired ticket');
 const input=portalRequest.parse(data.input);if(input.operation!=='file.download')throw new Error('Invalid ticket');return input;
}
