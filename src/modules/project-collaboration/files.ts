import {createHash} from 'node:crypto';
export const MAX_FILE_BYTES=20*1024*1024;
export function validateProjectFile(name:string,bytes:Uint8Array){
 if(!bytes.length||bytes.length>MAX_FILE_BYTES)throw new Error('Choose a file up to 20 MB.');
 const safeName=name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-180);
 const ext=safeName.split('.').pop()?.toLowerCase();
 const prefix=Buffer.from(bytes.subarray(0,16));
 let mime:string;
 if(ext==='pdf'&&prefix.subarray(0,5).toString()==='%PDF-')mime='application/pdf';
 else if(ext==='png'&&prefix.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
 else if(['jpg','jpeg'].includes(ext||'')&&prefix[0]===255&&prefix[1]===216&&prefix[2]===255)mime='image/jpeg';
 else if(['txt','csv'].includes(ext||'')&&!bytes.includes(0)){
  new TextDecoder('utf-8',{fatal:true}).decode(bytes);mime=ext==='csv'?'text/csv':'text/plain';
 }else throw new Error('Choose a PDF, PNG, JPEG, UTF-8 text or CSV file.');
 return {name:safeName,mime,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function validateDriveUrl(value:string){
 const url=new URL(value);
 if(url.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(url.hostname)||url.username||url.password||url.port)throw new Error('Use a Google Drive or Docs link.');
 return url.href;
}
