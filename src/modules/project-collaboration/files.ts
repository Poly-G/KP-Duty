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
 else if(['heic','heif'].includes(ext||'')){
  const header=bytes.subarray(0,256),view=new DataView(header.buffer,header.byteOffset,header.byteLength),size=header.length>=12?view.getUint32(0):0;
  const brands=header.length>=12?[Buffer.from(header.subarray(8,12)).toString()]:[];for(let i=16;i+4<=Math.min(size,header.length);i+=4)brands.push(Buffer.from(header.subarray(i,i+4)).toString());
  if(size<16||size>header.length||Buffer.from(header.subarray(4,8)).toString()!=='ftyp'||!brands.some(b=>['heic','heix','hevc','hevx','mif1','msf1'].includes(b)))throw new Error('Invalid iPhone photo.');
  mime=ext==='heic'?'image/heic':'image/heif';
 }else if(ext==='docx'){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),names:string[]=[];
  if(bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)throw new Error('Invalid Word document.');
  for(let i=0;i+46<=bytes.length;i++){if(view.getUint32(i,true)!==0x02014b50)continue;const length=view.getUint16(i+28,true),extra=view.getUint16(i+30,true),comment=view.getUint16(i+32,true);if(i+46+length+extra+comment>bytes.length)break;names.push(Buffer.from(bytes.subarray(i+46,i+46+length)).toString());i+=45+length+extra+comment;}
  if(!names.includes('[Content_Types].xml')||!names.includes('word/document.xml')||names.some(n=>/vbaProject|(?:^|\/)\.\.(?:\/|$)/i.test(n)))throw new Error('Invalid Word document.');
  mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 } else if(['txt','csv'].includes(ext||'')&&!bytes.includes(0)){
  new TextDecoder('utf-8',{fatal:true}).decode(bytes);mime=ext==='csv'?'text/csv':'text/plain';
 }else throw new Error('Choose a PDF, PNG, JPEG, HEIC/HEIF, Word DOCX, UTF-8 text or CSV file.');
 return {name:safeName,mime,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function validateDriveUrl(value:string){
 const url=new URL(value);
 if(url.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(url.hostname)||url.username||url.password||url.port)throw new Error('Use a Google Drive or Docs link.');
 return url.href;
}
