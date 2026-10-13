import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {validateProjectFile,MAX_FILE_BYTES,PROJECT_FILE_MIME_TYPES} from '../src/modules/project-collaboration/files.ts';
import {portalRequest} from '../src/modules/integrations/solta/receiver.ts';
import {kpFixture} from './helpers/solta-kp-fixture.mjs';

test('50 MB client uploads accept the boundary, reject larger files, and reserve every supported type',()=>{
 const bytes=Buffer.alloc(MAX_FILE_BYTES,32);bytes.write('%PDF-1.7\n');
 assert.equal(validateProjectFile('boundary.pdf',bytes).mime,'application/pdf');
 assert.throws(()=>validateProjectFile('oversize.pdf',Buffer.concat([bytes,Buffer.from('x')])));
 const base={version:1,operation:'file.reserve',business:'solta',projectId:randomUUID(),organizationId:randomUUID(),portalProjectId:randomUUID(),actorId:'qa',actorName:'Solta QA',actorRole:'member'};
 for(const mime of PROJECT_FILE_MIME_TYPES)assert.equal(portalRequest.parse({...base,payload:{requestId:randomUUID(),name:'qa-file',size:MAX_FILE_BYTES,mime,sha256:'a'.repeat(64)}}).payload.mime,mime);
 assert.equal(portalRequest.safeParse({...base,payload:{requestId:randomUUID(),name:'oversize.pdf',size:MAX_FILE_BYTES+1,mime:'application/pdf',sha256:'a'.repeat(64)}}).success,false);
});

test('static SVG stays passive and Office extensions must match their ZIP contents',async()=>{
 assert.equal(validateProjectFile('logo.svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>')).mime,'image/svg+xml');
 for(const source of ['<svg><script>alert(1)</script></svg>','<svg onload="alert(1)"/>','<svg><image href="https://example.com/x"/></svg>','<svg><image href=https://example.com/x /></svg>','<svg><style>@import "https://example.com/x";</style></svg>','<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>','<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>'])assert.throws(()=>validateProjectFile('active.svg',Buffer.from(source)));
 const book=new ExcelJS.Workbook();book.addWorksheet('QA').addRow(['Solta upload QA']);
 const bytes=new Uint8Array(await book.xlsx.writeBuffer());
 assert.equal(validateProjectFile('brief.xlsx',bytes).mime,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 assert.throws(()=>validateProjectFile('brief.pptx',bytes));assert.throws(()=>validateProjectFile('brief.docx',bytes));
});

test('database policy accepts 50 MB and new types while preserving private storage and RLS',async()=>{
 const db=await kpFixture();
 try{
 await db.exec(await readFile(new URL('../supabase/migrations/20261013032948_solta_upload_policy_50mb.sql',import.meta.url),'utf8'));
 const bucket=(await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='kp-project-files'")).rows[0];
 assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),MAX_FILE_BYTES);assert.deepEqual(new Set(bucket.allowed_mime_types),new Set(PROJECT_FILE_MIME_TYPES));
 const constraints=(await db.query("select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.solta_portal_files'::regclass and contype='c'")).rows;
 assert.match(constraints.find(c=>c.conname==='solta_portal_files_size_bytes_check').definition,/52428800/);
 for(const mime of PROJECT_FILE_MIME_TYPES)assert.ok(constraints.find(c=>c.conname==='solta_portal_files_mime_type_check').definition.includes(mime));
 assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.solta_portal_files'::regclass")).rows[0].relrowsecurity,true);
 const project=randomUUID(),company='20000000-0000-4000-8000-000000000001',portal=randomUUID();
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);select set_config('request.jwt.claim.role','authenticated',false)");
 await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[project,'solta',company,'Upload QA','website']);
 await db.query('select kp_link_solta_portal($1,$2,$3)',[project,company,portal]);
 await db.exec("reset role;set role service_role;select set_config('request.jwt.claim.role','service_role',false)");
 const reserve=(size,mime)=>db.query('select kp_solta_portal_operation($1,$2) as result',[JSON.stringify({version:1,operation:'file.reserve',business:'solta',projectId:project,organizationId:company,portalProjectId:portal,actorId:'qa',actorName:'QA',actorRole:'member',payload:{requestId:randomUUID(),name:'qa-file',size,mime,sha256:'a'.repeat(64)}}),randomUUID()]);
 for(const mime of PROJECT_FILE_MIME_TYPES)assert.equal((await reserve(MAX_FILE_BYTES,mime)).rows[0].result.state,'pending');
 await assert.rejects(()=>reserve(MAX_FILE_BYTES+1,'application/pdf'),/size_bytes_check/);
 await assert.rejects(()=>reserve(100,'application/javascript'),/mime_type_check/);
 await db.exec('reset role');
 await db.exec('set role anon');await assert.rejects(()=>db.query('select * from public.solta_portal_files'));
 }finally{await db.close();}
});
