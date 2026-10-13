import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOfficePaymentScope} from '../src/modules/integrations/solta/billing/office-scope.ts';
test('office creation and retry require approval of the current scope; approval of an older scope is insufficient',()=>{
 assert.throws(()=>assertOfficePaymentScope('less_office',undefined,[]),/Approve/);
 assert.throws(()=>assertOfficePaymentScope('less_office','v2',['v1']),/Approve/);
 assert.throws(()=>assertOfficePaymentScope('less_office','v2',['v1','v2'],'v1'),/Scope changed/);
 assert.doesNotThrow(()=>assertOfficePaymentScope('less_office','v2',['v2'],'v2'));
 assert.doesNotThrow(()=>assertOfficePaymentScope('website',undefined,[]));
});
