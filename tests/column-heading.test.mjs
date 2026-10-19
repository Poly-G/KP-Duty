import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source=(await readFile(new URL('../src/components/crm/column-heading.tsx',import.meta.url),'utf8'))
  .replace('import { useRouter } from "next/navigation";', 'const useRouter = () => ({ refresh() {} });')
  .replace('import { renameCrmColumn } from "@/modules/crm/column-actions";', 'const renameCrmColumn = () => { throw new Error("Unexpected mutation during rendering"); };');
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
const exports={};new Function('require','exports',outputText)(createRequire(import.meta.url),exports);
const stage={id:'00000000-0000-4000-8000-000000000001',slug:'new',name:'New',kind:'open',position:0};
function render(value){return renderToStaticMarkup(React.createElement(exports.ColumnHeading,{stage:value,pipelineId:'pipeline',onRenamed(){}}));}
test('built-in and terminal headings are locked with no rename button',()=>{
 for(const value of [stage,{...stage,kind:'won'},{...stage,kind:'lost'},{...stage,slug:'custom-other'}]){
  const html=render(value);assert.match(html,/Built-in column, name locked/);assert.doesNotMatch(html,/<button/);
 }
});
test('only a custom open heading exposes an accessible rename action',()=>{
 const html=render({...stage,slug:`custom-${stage.id}`,name:'Follow up'});
 assert.match(html,/Rename Follow up column/);assert.doesNotMatch(html,/name locked/);
});
