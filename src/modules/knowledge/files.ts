import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
export function validateLibraryFile(name:string,bytes:Buffer){
 if(!bytes.length||bytes.length>2*1024*1024)throw new Error('Choose a PDF or logo ZIP up to 2 MB.');
 const safe=name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-180);let mime:string;
 if(/\.pdf$/i.test(safe)&&bytes.subarray(0,5).toString()==='%PDF-')mime='application/pdf';
 else if(/\.zip$/i.test(safe)&&bytes.length>=4&&bytes.readUInt32LE(0)===0x04034b50){
  let entries=0,total=0;
  for(let i=0;i+46<=bytes.length;i++){
   if(bytes.readUInt32LE(i)!==0x02014b50)continue;
   entries++;const size=bytes.readUInt32LE(i+24),compressed=bytes.readUInt32LE(i+20),length=bytes.readUInt16LE(i+28),path=bytes.subarray(i+46,i+46+length).toString('utf8'),local=bytes.readUInt32LE(i+42),method=bytes.readUInt16LE(i+10);
   if(entries>200||size===0xffffffff||local+30>bytes.length||bytes.readUInt16LE(i+8)&1||path.startsWith('/')||path.includes('\\')||path.split('/').includes('..')||(!path.endsWith('/')&&!/\.(svg|png|jpg|jpeg|ico|txt|pdf)$/i.test(path)))throw new Error('Use a logo ZIP containing images, PDFs and text only.');
   if(bytes.readUInt32LE(local)!==0x04034b50)throw new Error('Invalid ZIP structure.');const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
   const remaining=25*1024*1024-total;if(start+compressed>bytes.length||size>remaining||remaining<=0)throw new Error('Logo ZIP expands beyond 25 MB.');
   const data=bytes.subarray(start,start+compressed),actual=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:remaining}):null;
   if(!actual||actual.length!==size)throw new Error('Invalid ZIP contents.');total+=actual.length;i+=45+length+bytes.readUInt16LE(i+30)+bytes.readUInt16LE(i+32);
  }
  if(!entries)throw new Error('Invalid logo ZIP.');mime='application/zip';
 }else throw new Error('Choose the original PDF or logo ZIP.');
 return {name:safe,mime,sha256:createHash('sha256').update(bytes).digest('hex')};
}
