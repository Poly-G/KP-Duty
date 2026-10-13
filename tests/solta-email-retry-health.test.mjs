import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retryToken} from '../src/modules/integrations/solta/notifications/retry-token.ts';
import {schedulerHealth} from '../src/modules/integrations/solta/notifications/health.ts';
test('only a database-generated v4 bearer tick is accepted',()=>{
 const token='5e4e10b8-4c51-488b-ade8-56a1424b5eb2';
 assert.equal(retryToken('Bearer '+token),token);
 for(const value of [null,'','bearer '+token,'Bearer '+token+' extra','Bearer undefined','Bearer sk_live_123','Bearer '+token.replace('-488b-','-188b-')])assert.equal(retryToken(value),null);
});
test('idle healthy scheduler and disabled scheduler do not alert',()=>{
 const now=Date.parse('2026-10-13T20:00:00Z');
 assert.equal(schedulerHealth(null,now),false);
 assert.equal(schedulerHealth({enabled:false,last_scan_at:null,last_started_at:null,last_completed_at:null,error_code:null},now),false);
 assert.equal(schedulerHealth({enabled:true,last_scan_at:new Date(now-300000).toISOString(),last_started_at:null,last_completed_at:null,error_code:null},now),false);
});
test('stale scans, lost workers, and recorded errors alert',()=>{
 const now=Date.parse('2026-10-13T20:00:00Z'),base={enabled:true,last_scan_at:new Date(now).toISOString(),last_started_at:null,last_completed_at:null,error_code:null};
 assert.equal(schedulerHealth({...base,last_scan_at:null},now),true);
 assert.equal(schedulerHealth({...base,last_scan_at:new Date(now-900001).toISOString()},now),true);
 assert.equal(schedulerHealth({...base,last_started_at:new Date(now-600001).toISOString()},now),true);
 assert.equal(schedulerHealth({...base,error_code:'EMAIL_RETRY_UNAVAILABLE'},now),true);
 assert.equal(schedulerHealth({...base,last_started_at:new Date(now-600001).toISOString(),last_completed_at:new Date(now-600000).toISOString()},now),false);
});
