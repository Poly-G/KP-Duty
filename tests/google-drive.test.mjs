import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {authorizationUrl,newState,matchesState,sealToken,openToken,exchangeCode,DRIVE_SCOPE,DRIVE_ACCOUNT,DRIVE_CALLBACK} from '../src/modules/integrations/google-drive/oauth.ts';
const config={clientId:'test-client',clientSecret:'test-only-secret'};
test('Drive uses limited file scope, fixed callback and unpredictable state',()=>{
 const a=newState(),b=newState();assert.notEqual(a,b);assert.equal(matchesState(a,a),true);
 for(const cookie of [undefined,b,'short',a+'x'])assert.equal(matchesState(a,cookie),false);
 const url=new URL(authorizationUrl(config,a));assert.equal(url.searchParams.get('redirect_uri'),DRIVE_CALLBACK);
 assert.equal(url.searchParams.get('scope'),`openid email ${DRIVE_SCOPE}`);
 assert.equal(url.searchParams.get('include_granted_scopes'),'false');assert.equal(url.searchParams.get('access_type'),'offline');
});
test('Stored refresh token is encrypted, authenticated and cannot survive wrong credentials',()=>{
 const token='synthetic-refresh-token',sealed=sealToken(token,config.clientSecret);
 assert.ok(!sealed.includes(token));assert.equal(openToken(sealed,config.clientSecret),token);
 assert.notEqual(sealed,sealToken(token,config.clientSecret));
 assert.throws(()=>openToken(sealed,'wrong-key'));
 assert.throws(()=>openToken(sealed.slice(0,-4)+'AAAA',config.clientSecret));
});
function google(email=DRIVE_ACCOUNT,scope=DRIVE_SCOPE,verified=true){return async(url)=>new Response(JSON.stringify(url.includes('/token')?{access_token:'fake-access',refresh_token:'fake-refresh',scope}:{email,email_verified:verified}),{headers:{'Content-Type':'application/json'}});}
test('Only the verified Solta account with the requested file grant can connect',async()=>{
 const result=await exchangeCode(config,'fake-code',google());assert.equal(result.email,DRIVE_ACCOUNT);assert.equal(openToken(result.encryptedRefreshToken,config.clientSecret),'fake-refresh');
 await assert.rejects(exchangeCode(config,'fake-code',google('someone@example.com')));
 await assert.rejects(exchangeCode(config,'fake-code',google(DRIVE_ACCOUNT,'openid email')));
 await assert.rejects(exchangeCode(config,'fake-code',google(DRIVE_ACCOUNT,DRIVE_SCOPE,false)));
});
test('Drive credentials and authorization state are inaccessible to browser database roles; state consumption is single-use',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table public.profiles(id uuid primary key);');
 await db.exec(await readFile(new URL('../supabase/migrations/20261012165918_solta_google_drive_connection.sql',import.meta.url),'utf8'));
 const id='00000000-0000-4000-8000-000000000001';await db.query('insert into profiles values ($1)',[id]);
 const hash='a'.repeat(64);await db.query("insert into solta_drive_oauth_states(state_hash,actor_id,expires_at) values ($1,$2,now()+interval '10 minutes')",[hash,id]);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);await assert.rejects(db.query('select * from solta_drive_connection'));await assert.rejects(db.query('select * from solta_drive_oauth_states'));await db.exec('reset role');
 }
 await db.exec('set role service_role');
 const consumed=await db.query('delete from solta_drive_oauth_states where state_hash=$1 and actor_id=$2 and expires_at>now() returning actor_id',[hash,id]);assert.equal(consumed.rows.length,1);
 const replay=await db.query('delete from solta_drive_oauth_states where state_hash=$1 returning actor_id',[hash]);assert.equal(replay.rows.length,0);
 }finally{await db.close();}
});
