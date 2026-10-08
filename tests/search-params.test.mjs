import test from 'node:test';
import assert from 'node:assert/strict';
import {firstSearchValue} from '../src/lib/ui/search-params.ts';
test('repeated search parameters remain strings and use the first supplied value',()=>{
 assert.equal(firstSearchValue(['Solta','Sent']),'Solta');
 assert.equal(firstSearchValue([]),'');assert.equal(firstSearchValue(undefined),'');
 assert.equal(firstSearchValue('x'.repeat(1000)).length,200);
 assert.equal(firstSearchValue(['yes','no']),'yes');
});
