import test from 'node:test';import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseCsv,normalizeLeads,suggestBusiness,findLeadHeader,suggestedHeaders} from '../src/modules/lead-imports/normalize.ts';
import {leadFileTable} from '../src/modules/lead-imports/files.ts';
test('CSV handles quoted commas, multiline research, BOM and route suggestions without mistaking a website URL for a service',()=>{
const table=parseCsv('\uFEFFCompany,Website,Service,Notes\r\n"Acme, LLC",acme.test,Website,"Research\nsecond line"\r\nMailCo,mail.test,Email marketing,Proof\r\nUnknown,unknown.test,,Review');
const rows=normalizeLeads(table,'snd');assert.equal(rows[0].company,'Acme, LLC');assert.equal(rows[0].notes,'Research\nsecond line');assert.equal(rows[0].business,'solta');assert.equal(rows[1].business,'snd');assert.equal(rows[2].business,'snd');assert.equal(rows[2].suggested,null);
assert.equal(suggestBusiness('website + email marketing'),null);assert.throws(()=>parseCsv('Company\n"unclosed'),/Unclosed/);assert.throws(()=>normalizeLeads([['Name','Company'],['A','A']],'solta'),/same field/);
const bad=normalizeLeads([['Company','Email','Website'],['A','bad','javascript:alert(1)']],'solta');assert.ok(bad[0].issue);
});
test('Excel reads values without evaluating formulas and rejects oversized, mixed-sheet or disguised files',async()=>{
const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Leads');sheet.addRow(['Company','Service']);sheet.addRow(['Acme','Website']);const bytes=Buffer.from(await workbook.xlsx.writeBuffer());
assert.deepEqual(await leadFileTable('leads.xlsx',bytes),[['Company','Service'],['Acme','Website']]);
sheet.getCell('B2').value={formula:'1+1',result:2};await assert.rejects(leadFileTable('formula.xlsx',Buffer.from(await workbook.xlsx.writeBuffer())),/Formula/);
workbook.addWorksheet('Other').addRow(['Second sheet']);await assert.rejects(leadFileTable('mixed.xlsx',Buffer.from(await workbook.xlsx.writeBuffer())),/one populated/);
await assert.rejects(leadFileTable('bad.xlsx',Buffer.from('not an excel workbook')),/Invalid XLSX/);await assert.rejects(leadFileTable('large.csv',Buffer.alloc(2*1024*1024+1)),/2 MB/);
});

test('Solta research headers preserve context, skip title rows and exclude duplicate identities',()=>{
 const headers=['Lead ID','Business','Website','Location','Priority','Stage','Visible Website / Digital Issue','Solta Proposal Angle','Ability-to-Pay Signal','Public Contact','Email','Outreach Channel','Next Action','Outreach Allowed?','Source URL'];
 const table=[['Solta Website Leads'],['Historical source note'],headers,['LEAD-001','Example Co','No clear owned site found','Nevada','High','Qualified','No booking path','Create website','Commercial services','555-0100','','Phone','Prepare proposal','No — qualified only','https://example.test'],['LEAD-002','Example-Co','','','','','','','','','','','','','']];
 assert.equal(findLeadHeader(table),2);assert.equal(suggestedHeaders(headers)[1],'company');
 const rows=normalizeLeads(table.slice(2),'solta');assert.equal(rows[0].issue,null);assert.equal(rows[0].website,'');assert.equal(rows[0].business,'solta');assert.equal(rows[0].service,'Website');assert.match(rows[0].notes,/Outreach allowed\?: No — qualified only/);assert.match(rows[0].notes,/Public contact: 555-0100/);assert.match(rows[1].issue,/Duplicate/);
 assert.equal(suggestedHeaders(['Company','Destination Business'])[1],'business');
});

test('CSV tabs preserve column positions, TSV commas remain text and BOM quoted headers parse',()=>{
 const csv=parseCsv('\uFEFF"Company",Website,Notes,Email\nAcme,acme.test,Research\twith tab,owner@acme.test');
 assert.deepEqual(csv[1],['Acme','acme.test','Research\twith tab','owner@acme.test']);
 const rows=normalizeLeads(csv,'solta');assert.equal(rows[0].email,'owner@acme.test');assert.equal(rows[0].issue,null);
 assert.deepEqual(parseCsv('Company\tNotes\nAcme\tResearch, with comma')[1],['Acme','Research, with comma']);
 assert.throws(()=>normalizeLeads(parseCsv('Company,Email\nAcme,owner@acme.test,unmapped'),'solta'),/more cells than the header/);
 assert.throws(()=>parseCsv(Array(51).fill('a').join(',')),/50 columns/);
});
test('invalid combined research notes do not suppress a later valid duplicate',()=>{
 const rows=normalizeLeads([['Company','Notes','Location'],['Acme','x'.repeat(9999),'Long location'],['Acme','Valid','Here']],'solta');
 assert.match(rows[0].issue,/Combined/);assert.equal(rows[1].issue,null);
});
