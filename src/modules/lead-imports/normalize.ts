export type LeadBusiness='solta'|'snd';
export type LeadRow={row:number;company:string;website:string;domain:string;email:string;contact:string;phone:string;service:string;source:string;source_url:string;notes:string;business:LeadBusiness;suggested:LeadBusiness|null;issue:string|null;override_reason:string};
export const leadColumns={company:'Company',website:'Website / domain',email:'Email',contact:'Contact name',phone:'Phone',service:'Service needed',business:'Destination business',source:'Source',source_url:'Source / evidence URL',notes:'Research notes'};
const researchColumns:Record<string,string>={lead_id:'Lead ID',location:'Location',priority:'Priority',stage:'Source stage',website_issue:'Visible website / digital issue',proposal_angle:'Solta proposal angle',payment_signal:'Ability-to-pay signal',public_contact:'Public contact',outreach_channel:'Outreach channel',next_action:'Next action',outreach_allowed:'Outreach allowed?'};
Object.assign(leadColumns,researchColumns);
const aliases:Record<string,string>={company:'company',companyname:'company',businessname:'company',organization:'company',name:'company',leadname:'company',companyleadname:'company',organizationname:'company',businesscompany:'company',website:'website',url:'website',domain:'website',email:'email',contactemail:'email',publicemail:'email',contact:'contact',contactname:'contact',fullname:'contact',phone:'phone',phonenumber:'phone',service:'service',serviceneeded:'service',requestedservice:'service',serviceinterest:'service',offering:'service',need:'service',projecttype:'service',business:'business',destinationbusiness:'business',brand:'business',source:'source',sourcedby:'source',sourceurl:'source_url',evidenceurl:'source_url',notes:'notes',reason:'notes',researchnotes:'notes',reasonforfit:'notes',leadid:'lead_id',location:'location',priority:'priority',stage:'stage',visiblewebsitedigitalissue:'website_issue',soltaproposalangle:'proposal_angle',abilitytopaysignal:'payment_signal',publiccontact:'public_contact',outreachchannel:'outreach_channel',nextaction:'next_action',outreachallowed:'outreach_allowed'};
export function findLeadHeader(table:string[][]):number{
 return table.slice(0,10).findIndex(row=>{const mapped=suggestedHeaders(row);return mapped.includes('company')&&mapped.filter(Boolean).length>=2;});
}
export function parseCsv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;let closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
 else if(c==='"'){if(cell||closed)throw new Error('Invalid CSV quotes. Export the sheet as CSV again.');quoted=true;}
 else if(c===','||c==='\t'){row.push(cell);cell='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;}
 else{if(closed&&!/\s/.test(c))throw new Error('Invalid CSV after quoted cell.');if(!closed)cell+=c;}
 if(cell.length>10000||row.length>50||rows.length>501)throw new Error('Use up to 500 leads, 50 columns and 10,000 characters per cell.');
 }if(quoted)throw new Error('Unclosed CSV quote.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function suggestBusiness(service:string):LeadBusiness|null{
 const solta=/\b(website|web design|branding|brand design|logo|less office|workflow automation|website care)\b/i.test(service);
 const snd=/\b(snd|s&d|sent.?delivered|email marketing|lifecycle|deliverability|klaviyo|email automation)\b/i.test(service);
 return solta===snd?null:solta?'solta':'snd';
}
export function suggestedHeaders(headers:string[]):string[]{
 const mapped=headers.map(h=>aliases[h.replace(/^\uFEFF/,'').toLowerCase().replace(/[^a-z0-9]/g,'')]||'');
 // Research sheets use Business for the prospect; a separate Company column disambiguates destination.
 if(!mapped.includes('company')){const i=headers.findIndex(h=>h.trim().toLowerCase()==='business');if(i>=0)mapped[i]='company';}
 return mapped;
}
export function normalizeLeads(table:string[][],selected:LeadBusiness,mapping?:string[]):LeadRow[]{
 if(table.length<2||table.length>501)throw new Error('Include a header row and 1–500 leads.');
 const headers=mapping||suggestedHeaders(table[0]);
 if(headers.length!==table[0].length||headers.some(key=>key&&!Object.hasOwn(leadColumns,key)))throw new Error('Invalid column mapping.');
 if(!headers.includes('company'))throw new Error('Add a Company or Business name column.');
 const recognized=headers.filter(Boolean);if(new Set(recognized).size!==recognized.length)throw new Error('Two columns map to the same field. Rename or remove one.');
 const seen=new Set<string>();
 return table.slice(1).map((cells,index)=>{
  const data:Record<string,string>={};headers.forEach((key,i)=>{if(key)data[key]=(cells[i]||'').trim();});
  let issue:string|null=null;let domain='';let website=data.website||'';
  if(!data.company)issue='Company name is required.';
  if(Object.values(data).some(v=>v.length>10000))issue='A cell exceeds 10,000 characters.';
  if(/^(no (clear )?(owned )?(site|website)( found)?|not found|none|n\/a|unknown)$/i.test(website))website='';
  if(website){try{const u=new URL(/^https?:\/\//i.test(website)?website:`https://${website}`);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.'))throw new Error();website=u.href;domain=u.hostname.replace(/^www\./,'').toLowerCase();}catch{issue='Invalid website URL.';}}
  if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))issue='Invalid email.';
  if(data.source_url){try{const u=new URL(data.source_url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error();}catch{issue='Invalid source URL.';}}
  const explicit=data.business?.toLowerCase().replace(/[^a-z]/g,'');const declared=explicit==='solta'? 'solta': ['snd','sentdelivered','sentanddelivered'].includes(explicit)?'snd':null;
  if(explicit&&!declared)issue='Unknown or paused business. Choose Solta or Sent.';
  const service=data.service||(headers.includes('proposal_angle')?'Website':'');
  const suggested=suggestBusiness(service);
  const business=declared||suggested||selected;
  const companyKey=(data.company||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const identities=[companyKey&&business+'|name:'+companyKey,domain&&business+'|domain:'+domain,data.email&&business+'|email:'+data.email.toLowerCase()].filter(Boolean) as string[];
  if(!issue&&identities.some(key=>seen.has(key)))issue='Duplicate in this sheet; only the first matching row is selected.';
  if(!issue)identities.forEach(key=>seen.add(key));
  const notes=[data.notes||'',...Object.entries(researchColumns).filter(([key])=>data[key]).map(([key,label])=>`${label}: ${data[key]}`)].filter(Boolean).join('\n');
  if(notes.length>10000)issue='Combined research notes exceed 10,000 characters.';
  return {row:index+2,company:data.company||'',website,domain,email:data.email||'',contact:data.contact||'',phone:data.phone||'',service,source:data.source||'Spreadsheet research',source_url:data.source_url||'',notes,business,suggested,issue,override_reason:''};
 });
}
