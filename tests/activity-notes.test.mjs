import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Compile the actual modules with only framework/auth/database boundaries stubbed.
async function moduleFrom(path, replace) {
  const source = replace(await readFile(new URL(path, import.meta.url), 'utf8'));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
  const { createRequire } = await import('node:module');
  const exports = {};
  new Function('require', 'exports', outputText)(createRequire(import.meta.url), exports);
  return exports;
}
const service = await moduleFrom('../src/modules/activity/service.ts', s => s.replace(/import \{[^;]*?\} from "@\/modules\/domain\/action-rpc";/, 'const callIdempotentDomainRpc = async value => value;'));

test('note creation validates and trims text and uses the existing RPC with stable request key', async () => {
  const input = { entityType: 'task', entityId: '00000000-0000-4000-8000-000000000001', note: '  Follow up\nFriday  ' };
  const args = { input, source: 'ui', requestKey: 'retry-key' };
  const result = await service.addActivityNote(args);
  assert.deepEqual(result, { functionName: 'kp_add_note', source: 'ui', requestKey: 'retry-key', payload: { ...input, note: 'Follow up\nFriday' } });
  assert.deepEqual(await service.addActivityNote(args), result);
  for (const note of [' ', 'x'.repeat(20001)]) await assert.rejects(service.addActivityNote({ ...args, input: { ...input, note } }));
  for (const entityType of ['task', 'opportunity', 'project', 'organization', 'person', 'decision']) assert.equal(service.addNoteInputSchema.parse({ ...input, entityType }).entityType, entityType);
  assert.throws(() => service.addNoteInputSchema.parse({ ...input, entityType: 'unknown' }));
});

test('history is authenticated, scoped to the direct target, and paginated with stable ordering', async () => {
  globalThis.noteTest = { service, calls: [], error: null, authenticated: true };
  const actions = await moduleFrom('../src/modules/activity/actions.ts', s => s
    .replace(/import \{ requireActiveIdentity \}[^;]+;/, 'const requireActiveIdentity = async () => { if (!globalThis.noteTest.authenticated) throw new Error("unauthorized"); globalThis.noteTest.calls.push(["auth"]); };')
    .replace(/import \{ createClient \}[^;]+;/, `const createClient = async () => { const query = new Proxy({}, { get: (_, name) => name === 'then' ? resolve => resolve({data: [], error: globalThis.noteTest.error}) : (...args) => {globalThis.noteTest.calls.push([name,...args]); return query;} }); return {from: (...args) => {globalThis.noteTest.calls.push(["from",...args]); return query;}}; };`)
    .replace(/import \{ addActivityNote[^;]+;/, 'const {addActivityNote, addNoteInputSchema} = globalThis.noteTest.service;'));
  for (const entityType of ['task', 'opportunity', 'project', 'organization', 'person', 'decision']) {
    globalThis.noteTest.calls = [];
    await actions.getNotes({entityType, entityId:'00000000-0000-4000-8000-000000000001'}, 50);
    const calls = globalThis.noteTest.calls;
    assert.deepEqual(calls[0], ['auth']);
    assert.ok(calls.some(c => c[0] === 'eq' && c[1] === `${entityType}_id`));
    assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'metadata->>entityType' && c[2] === entityType));
    assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'event_type' && c[2] === 'note.added'));
    assert.ok(calls.some(c => c[0] === 'order' && c[1] === 'id'));
    assert.deepEqual(calls.at(-1), ['range',50,99]);
  }
  globalThis.noteTest.error = {message:'database error'};
  await assert.rejects(actions.getNotes({entityType:'task',entityId:'00000000-0000-4000-8000-000000000001'}), /Unable to load notes/);
  globalThis.noteTest.authenticated = false;
  await assert.rejects(actions.getNotes({entityType:'task',entityId:'00000000-0000-4000-8000-000000000001'}), /unauthorized/);
  delete globalThis.noteTest;
});

test('history renders full note text safely with author and timestamp; collapsed notes do not fetch', async () => {
  const components = await moduleFrom('../src/components/activity/record-notes.tsx', s => s.replace(/import \{ createNote[^;]+;/, 'const createNote = () => {throw new Error("unexpected write")}; const getNotes = () => {throw new Error("unexpected read")};'));
  const html = renderToStaticMarkup(React.createElement(components.NoteHistory, { notes: [{id:'one', occurred_at:'2026-10-15T18:00:00Z', metadata:{note:'First line\n<script>alert(1)</script>'}, actor:{display_name:'Keshia'}}] }));
  assert.match(html,/Keshia/); assert.match(html,/dateTime="2026-10-15T18:00:00Z"/i);
  assert.match(html,/First line\n&lt;script&gt;/); assert.doesNotMatch(html,/<script>/);
  const collapsed = renderToStaticMarkup(React.createElement(components.RecordNotes, {entityType:'task',entityId:'one'}));
  assert.match(collapsed,/Notes · Add note/); assert.doesNotMatch(collapsed,/<textarea/);
});
