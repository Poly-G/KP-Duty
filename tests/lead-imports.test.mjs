import test from 'node:test';import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseCsv,normalizeLeads,suggestBusiness} from '../src/modules/lead-imports/normalize.ts';
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
