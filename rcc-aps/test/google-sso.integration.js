'use strict';
// Real HTTP, isolated MySQL and Google's real JWT verifier, using test-only RSA keys.
const assert = require('assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { OAuth2Client } = require('google-auth-library');
const database = 'rcc_aps_sso_validation_' + Date.now();
const originalDatabase = process.env.DB_NAME || 'rcc_aps';
process.env.DB_NAME = database;
delete process.env.GOOGLE_CLIENT_ID;
const audience = '123456789-sso-test.apps.googleusercontent.com';
const {privateKey,publicKey} = crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const originalCerts = OAuth2Client.prototype.getFederatedSignonCertsAsync;
OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({certs:{'sso-test':publicKey.export({type:'spki',format:'pem'})}});
let root,server;
async function run() {
  root = await mysql.createConnection({host:process.env.DB_HOST || 'localhost',user:process.env.DB_USER || 'root',password:process.env.DB_PASSWORD || ''});
  await require('../server/db/init').init();
  const db = require('../server/db');
  const password = 'test-only-sso-password';
  const pass = await require('bcryptjs').hash(password,10);
  const users = ['admin','finance','employee'].map((role,index)=>({id:index+1,first:role,last:'Test',email:role+'@rcc.edu.ph',role:['System Admin','Finance Officer','Employee'][index],status:'Active',salary:20000,classification:'Non-Teaching'}));
  const auth = Object.fromEntries(users.map((user,index)=>[user.id,{...user,pass,label:user.role,role:['admin','finance','employee'][index],page:['adminPage','financePage','empPage'][index]}]));
  await db.persistState({users,auth});
  server = require('../server/server').app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  async function request(path,body,options={}) {
    const response = await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...options},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
  }
  const passwordLogin = await request('/api/auth/login',{email:'admin@rcc.edu.ph',password});
  assert.equal(passwordLogin.status,200);
  assert.equal((await request('/api/auth/login',{email:'admin@gmail.com',password})).status,403);
  assert.equal((await request('/api/auth/google/config')).data.enabled,false);
  assert.equal((await request('/api/auth/google',{credential:'anything'})).status,503);
  process.env.GOOGLE_CLIENT_ID = audience;
  async function challenge() {
    const result = await request('/api/auth/google/config');
    assert.equal(result.data.enabled,true);assert.equal(result.data.domain,'rcc.edu.ph');
    assert.match(result.cookie,/HttpOnly/);assert.match(result.cookie,/SameSite=Strict/);
    return {nonce:result.data.nonce,cookie:result.cookie.split(';')[0]};
  }
  function token(nonce,overrides={}) {
    const now = Math.floor(Date.now()/1000);
    return jwt.sign({iss:'https://accounts.google.com',aud:audience,iat:now,exp:now+3600,sub:'google-existing',email:'employee@rcc.edu.ph',email_verified:true,hd:'rcc.edu.ph',nonce,...overrides},privateKey,{algorithm:'RS256',keyid:'sso-test'});
  }
  async function login(overrides={},session) {
    const current = session || await challenge();
    return request('/api/auth/google',{credential:token(current.nonce,overrides)},{Cookie:current.cookie,'X-Requested-With':'RCC-APS'});
  }
  assert.equal((await request('/api/auth/google',{credential:token('missing')})).status,401);
  const csrf = await challenge();
  assert.equal((await request('/api/auth/google',{credential:token(csrf.nonce)},{Cookie:csrf.cookie})).status,401);
  for (const claims of [
    {email:'someone@gmail.com'}, {email:'someone@evilrcc.edu.ph'},
    {hd:'different.edu.ph'}, {hd:undefined}, {email_verified:false}, {nonce:'wrong'}
  ]) assert.equal((await login(claims)).status,403);
  for (const claims of [{aud:'wrong-client'}, {iss:'https://attacker.example'}, {iat:1,exp:2}]) assert.equal((await login(claims)).status,401);
  const forged = await challenge();
  assert.equal((await request('/api/auth/google',{credential:jwt.sign({nonce:forged.nonce},'attacker',{keyid:'sso-test'})},{Cookie:forged.cookie,'X-Requested-With':'RCC-APS'})).status,401);
  const originalCount = (await db.assembleState()).users.length;
  const existingSession = await challenge();
  const existing = await login({},existingSession);
  assert.equal(existing.status,200);assert.equal(existing.data.user.id,3);assert.equal(existing.data.user.role,'employee');
  assert.equal((await login({},existingSession)).status,401,'Google nonce cannot be replayed');
  assert.equal((await db.assembleState()).users.length,originalCount);
  assert.equal((await login({sub:'different-google-account'})).status,403,'Linked account cannot be taken over by a different Google subject');
  const finance = await login({email:'finance@rcc.edu.ph',sub:'google-finance',role:'admin'});
  assert.equal(finance.status,200);assert.equal(finance.data.user.role,'finance');
  const oldState = await db.assembleState();
  const unknown = await login({email:'new.employee@rcc.edu.ph',sub:'google-new',given_name:'Google Name',role:'admin',salary:99999});
  assert.equal(unknown.status,403);assert.match(unknown.data.error,/not registered.*System Administrator/);
  assert.equal(unknown.data.token,undefined);
  const afterDenied = await db.assembleState();
  assert.deepEqual(afterDenied.users,oldState.users);assert.deepEqual(afterDenied.auth,oldState.auth);
  assert.equal(afterDenied.stateRevision,oldState.stateRevision);assert.equal(afterDenied.nextUserId,oldState.nextUserId);
  // The Admin explicitly provisions an account before Google sign-in can link it.
  const provision = await request('/api/data',null,{Authorization:'Bearer '+passwordLogin.data.token});
  const addedId = provision.data.nextUserId;
  provision.data.users.push({id:addedId,first:'Admin Created',last:'Employee',email:'new.employee@rcc.edu.ph',role:'Employee',status:'Active',classification:'Non-Teaching'});
  provision.data.auth = {[addedId]:{id:addedId,pass:password}};
  assert.equal((await request('/api/data',provision.data,{Authorization:'Bearer '+passwordLogin.data.token})).status,200);
  const beforeLink = await db.assembleState();
  const concurrentSessions = await Promise.all([challenge(),challenge()]);
  const concurrent = await Promise.all(concurrentSessions.map(session=>login({email:'new.employee@rcc.edu.ph',sub:'google-new',given_name:'Google Name',role:'admin',salary:99999},session)));
  assert.deepEqual(concurrent.map(result=>result.status),[200,200]);
  assert.equal(concurrent[0].data.user.id,addedId);assert.equal(concurrent[1].data.user.id,addedId);
  const newAccount = concurrent[0];
  assert.equal(newAccount.data.user.role,'employee');
  const after = await db.assembleState();
  const added = after.users.find(user=>user.id===addedId);
  assert.equal(added.salary,0);assert.equal(added.role,'Employee');assert.equal(added.first,'Admin Created');
  assert.equal(after.users.length,originalCount+1);assert.equal(after.stateRevision,beforeLink.stateRevision+1);
  assert.equal(after.auth[added.id].pass,beforeLink.auth[added.id].pass);
  assert.doesNotMatch(JSON.stringify(newAccount.data),/googleSub|"pass"|given_name/);
  const employeeState = await request('/api/data',null,{Authorization:'Bearer '+newAccount.data.token});
  assert.equal(employeeState.status,200);assert.deepEqual(employeeState.data.users.map(user=>user.id),[added.id]);
  assert.deepEqual(employeeState.data.auth,{});
  const stale = await request('/api/data',oldState,{Authorization:'Bearer '+finance.data.token});
  assert.equal(stale.status,409,'Admin provisioning and first-time linking invalidate stale state');
  const adminGoogle = await login({email:'admin@rcc.edu.ph',sub:'google-admin',role:'employee'});
  assert.equal(adminGoogle.status,200);assert.equal(adminGoogle.data.user.role,'admin');assert.equal(adminGoogle.data.user.page,'adminPage');
  await db.q("UPDATE auth SET status='Inactive' WHERE id=3");
  assert.equal((await login()).status,403);
  assert.equal((await db.assembleState()).users.filter(user=>user.email==='employee@rcc.edu.ph').length,1);
  await db.q("UPDATE auth SET status='Active' WHERE id=3");
  await db.persistState(await db.assembleState());
  assert.equal((await db.q('SELECT googleSub FROM auth WHERE id=3'))[0].googleSub,'google-existing','Regular saves preserve the Google binding');
  const administrator = await request('/api/data',null,{Authorization:'Bearer '+passwordLogin.data.token});
  administrator.data.users.find(user=>user.id===3).email='outside@gmail.com';
  assert.equal((await request('/api/data',administrator.data,{Authorization:'Bearer '+passwordLogin.data.token})).status,400);
  if (process.env.BROWSER_VALIDATE === '1') {
    console.log('Browser verification URL: '+base);
    await new Promise(resolve=>require('../server/server').app.post('/__validation/finish',(req,res)=>{res.json({ok:true});resolve();}));
  }
  console.log('PASS: Google JWT verification, RCC domain enforcement, one-time nonce, unregistered accounts denied without writes, Admin-created accounts only, all three roles preserved, concurrent linking, identity persistence and scoped sessions.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  OAuth2Client.prototype.getFederatedSignonCertsAsync = originalCerts;
  if(server)await new Promise(resolve=>server.close(resolve));
  if(root){
    if(!/^rcc_aps_sso_validation_\d+$/.test(database) || database===originalDatabase)throw Error('Unsafe test database cleanup');
    await root.query('DROP DATABASE IF EXISTS `'+database+'`');await root.end();
  }
  process.exit(process.exitCode || 0);
});
