'use strict';
// Creates and drops its own isolated database; never mutates the application DB.
const assert = require('assert/strict');
const mysql = require('mysql2/promise');
const originalDatabase = process.env.DB_NAME || 'rcc_aps';
const testDatabase = 'rcc_aps_validation_' + Date.now();
process.env.DB_NAME = testDatabase;
const connectionOptions = {host:process.env.DB_HOST || 'localhost', user:process.env.DB_USER || 'root', password:process.env.DB_PASSWORD || '', dateStrings:true};
let root, server;
async function run() {
  assert.notEqual(testDatabase,originalDatabase);
  root = await mysql.createConnection(connectionOptions);
  let legacyPayroll;
  if (process.env.UPGRADE_BACKUP_FIXTURE) {
    const snapshot = JSON.parse(require('zlib').gunzipSync(require('fs').readFileSync(process.env.UPGRADE_BACKUP_FIXTURE)));
    await root.query('CREATE DATABASE `' + testDatabase + '` CHARACTER SET utf8mb4');
    await root.query('USE `' + testDatabase + '`');
    await root.query('SET FOREIGN_KEY_CHECKS=0');
    for (const [name,table] of Object.entries(snapshot.tables)) {
      if (!/^\w+$/.test(name)) throw Error('Invalid backup table name');
      await root.query(table.ddl);
      for (const row of table.records) {
        const columns = Object.keys(row);
        await root.query('INSERT INTO `' + name + '` (' + columns.map(col=>'`'+col+'`').join(',') + ') VALUES (' + columns.map(()=>'?').join(',') + ')',columns.map(col=>row[col]));
      }
    }
    await root.query('SET FOREIGN_KEY_CHECKS=1');
    [legacyPayroll] = await root.query('SELECT id,empId,gross,net FROM payroll_records ORDER BY id');
  }
  await require('../server/db/init').init();
  if (legacyPayroll) {
    const [upgradedPayroll] = await root.query('SELECT id,empId,gross,net FROM payroll_records ORDER BY id');
    assert.deepEqual(upgradedPayroll,legacyPayroll,'Migration must preserve all existing payroll IDs and amounts');
    console.log('PASS: legacy backup migration preserves payroll records and amounts.');
  }
  const db = require('../server/db');
  assert.equal((await db.status()).connected,true,'Startup health check must support DATE-string connections');
  if (legacyPayroll) {
    await db.persistState(await db.assembleState());
    const [roundTripPayroll] = await root.query('SELECT id,empId,gross,net FROM payroll_records ORDER BY id');
    assert.deepEqual(roundTripPayroll,legacyPayroll,'Full legacy-state round-trip must preserve payroll');
  }
  const password = 'test-only-secure-password';
  const hash = await require('bcryptjs').hash(password,10);
  const users = ['admin','finance','employee'].map((role,index) => ({id:index+1,first:role,last:'Test',email:role+'@rcc.edu.ph',role:['System Admin','Finance Officer','Employee'][index],status:'Active',classification:index===2?'Teaching':'Non-Teaching',schoolLevel:index===2?'College':'',department:'CCS',salary:20000,hourlyRate:index===2?190:0,rankId:index===2?3:0,hireDate:'2025-06-01',date:'Oct 20, 2026'}));
  const auth = Object.fromEntries(users.map((user,index)=>[user.id,{id:user.id,email:user.email,role:['admin','finance','employee'][index],page:['adminPage','financePage','empPage'][index],label:user.role,status:'Active',pass:hash}]));
  await db.persistState({users,auth,teacherRanks:[{id:3,department:'College',rank:'Instructor 1',rate:190}],profiles:{3:{empPhone:'0917',empAddr:'City',photo:'data:image/jpeg;base64,AQID'}},leaveTypes:[{id:1,name:'Unpaid',isPaid:false}],leaveRecords:[{id:1,empId:3,typeId:1,startDate:'2026-10-20',endDate:'2026-10-20',days:0.5}],workDays:22,hoursPerWorkload:3,payrollRecords:[{empId:3,name:'employee Test',month:10,year:2026,period:'October 2026',gross:20000,net:19000,date:'Oct 20, 2026',salaryBase:20000,absenceWorkDays:26,absenceDays:0.5,teachingSemester:'2nd',teachingSchoolYear:'2026-2027',customDeds:[{name:'PERAA',amount:500}],bonuses:Array.from({length:6},(_,index)=>({name:'Long bonus description '+index+' '.repeat(50),amount:100}))}]});
  const state = await db.assembleState();
  assert.equal(Number(state.leaveRecords[0].days),0.5);
  assert.equal(state.payrollRecords[0].absenceWorkDays,26);
  assert.equal(state.payrollRecords[0].teachingSemester,'2nd');
  assert.equal(state.payrollRecords[0].teachingSchoolYear,'2026-2027');
  assert.equal(state.payrollRecords[0].salaryBase,20000);
  assert.equal(state.payrollRecords[0].bonuses.length,6);
  assert.equal(state.profiles[3].photo,'data:image/jpeg;base64,AQID');
  const [idsBefore] = await root.query('SELECT id FROM `' + testDatabase + '`.payroll_records');
  await db.persistState(state);
  const [idsAfter] = await root.query('SELECT id FROM `' + testDatabase + '`.payroll_records');
  assert.deepEqual(idsBefore,idsAfter,'Unchanged payroll IDs must remain stable');
  // Foreign keys and unique payroll periods are enforced in MySQL itself.
  await assert.rejects(root.query('INSERT INTO `' + testDatabase + '`.payroll_records (empId,year,month) VALUES (3,2026,10)'),error=>error.code==='ER_DUP_ENTRY');
  await assert.rejects(root.query('INSERT INTO `' + testDatabase + '`.profiles (id) VALUES (999)'),error=>error.code==='ER_NO_REFERENCED_ROW_2');
  await assert.rejects(root.query('DELETE FROM `' + testDatabase + '`.users WHERE id=3'),error=>error.code==='ER_ROW_IS_REFERENCED_2');
  // Validate real HTTP authorization and data scoping with real MySQL storage.
  server = require('../server/server').app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (route,token,body) => {
    const response = await fetch(base+route,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json()};
  };
  for (const route of ['/api/data','/api/employees','/api/leaves']) assert.equal((await request(route)).status,401);
  assert.equal((await request('/api/hris/sync',null,{stateRevision:0})).status,401);
  const tokens={};
  for (const role of ['admin','finance','employee']) {
    const login=await request('/api/auth/login',null,{email:role+'@rcc.edu.ph',password});
    assert.equal(login.status,200);tokens[role]=login.data.token;
  }
  const employee=(await request('/api/data',tokens.employee)).data;
  assert.deepEqual(employee.users.map(user=>user.id),[3]);assert.deepEqual(employee.auth,{});
  assert.deepEqual(Object.keys(employee.profiles),['3']);
  assert.equal((await request('/api/hris/sync',tokens.employee,{stateRevision:employee.stateRevision})).status,403);
  const admin=(await request('/api/data',tokens.admin)).data;
  assert.deepEqual(admin.profiles[3],{photo:'data:image/jpeg;base64,AQID'});
  assert.equal(admin.users.find(user=>user.id===3).salary,undefined);
  assert.equal(admin.users.find(user=>user.id===3).hourlyRate,undefined);
  assert.equal(admin.payrollRecords.length,0);
  assert.deepEqual(admin.auth,{});
  const finance=(await request('/api/data',tokens.finance)).data;
  assert.equal(finance.users.find(user=>user.id===3).salary,20000);
  assert.deepEqual(finance.auth,{});
  // A forged client payload cannot assign another user's salary, role or photo.
  const tampered=structuredClone(employee);tampered.users[0].salary=1;tampered.users[0].role='System Admin';tampered.profiles[1]={photo:'data:image/jpeg;base64,AAAA'};
  const ownSave=await request('/api/data',tokens.employee,tampered);assert.equal(ownSave.status,200);
  const stored=await db.assembleState();assert.equal(stored.users.find(user=>user.id===3).salary,20000);assert.equal(stored.users.find(user=>user.id===3).role,'Employee');assert.equal(stored.profiles[1],undefined);
  // Old full snapshots cannot overwrite a newer save.
  assert.equal((await request('/api/data',tokens.finance,finance)).status,409);
  const concurrentA=(await request('/api/data',tokens.finance)).data;
  const concurrentB=structuredClone(concurrentA);
  concurrentA.users.find(user=>user.id===3).salary=21000;
  concurrentB.users.find(user=>user.id===3).salary=22000;
  const saves=await Promise.all([request('/api/data',tokens.finance,concurrentA),request('/api/data',tokens.finance,concurrentB)]);
  assert.deepEqual(saves.map(result=>result.status).sort(),[200,409]);
  const afterConcurrent=await db.assembleState();assert.ok([21000,22000].includes(afterConcurrent.users.find(user=>user.id===3).salary));
  // Metadata edits preserve Finance-owned pay and passwords; new passwords hash on server.
  const freshAdmin=(await request('/api/data',tokens.admin)).data;
  const originalHash=afterConcurrent.auth[3].pass;
  freshAdmin.users.find(user=>user.id===3).first='Updated';freshAdmin.users.find(user=>user.id===3).salary=1;
  const savedAdmin=await request('/api/data',tokens.admin,freshAdmin);assert.equal(savedAdmin.status,200);
  const afterAdmin=await db.assembleState();assert.equal(afterAdmin.auth[3].pass,originalHash);assert.equal(afterAdmin.users.find(user=>user.id===3).salary,afterConcurrent.users.find(user=>user.id===3).salary);
  const newAdmin=(await request('/api/data',tokens.admin)).data;
  newAdmin.users.push({...users[2],id:4,email:'new@rcc.edu.ph',first:'New',salary:99999});
  newAdmin.auth={4:{id:4,pass:password}};
  assert.equal((await request('/api/data',tokens.admin,newAdmin)).status,200);
  const afterNew=await db.assembleState();assert.equal(afterNew.users.find(user=>user.id===4).salary,0);assert.ok(await require('bcryptjs').compare(password,afterNew.auth[4].pass));
  const hrisAdmin=(await request('/api/data',tokens.admin)).data;
  const imported=await request('/api/hris/sync',tokens.admin,{stateRevision:hrisAdmin.stateRevision});assert.equal(imported.status,200);assert.deepEqual(imported.data.state.auth,{});assert.doesNotMatch(JSON.stringify(imported.data),/\"pass\":|\"password\":|\$2[ab]\$/);
  const hrisFinance=(await request('/api/data',tokens.finance)).data;
  const attendanceImport=await request('/api/hris/sync',tokens.finance,{stateRevision:hrisFinance.stateRevision});assert.equal(attendanceImport.status,200);
  const employeeAgain=(await request('/api/data',tokens.employee)).data;
  assert.equal(employeeAgain.profiles[3].photo,'data:image/jpeg;base64,AQID');
  assert.equal(employeeAgain.payrollRecords[0].absenceDays,0.5);
  if (process.env.BROWSER_VALIDATE === '1') {
    console.log('Browser verification URL: ' + base);
    await new Promise(resolve => {
      require('../server/server').app.post('/__validation/finish',(req,res)=>{res.json({ok:true});resolve();});
    });
  }
  console.log('PASS: isolated MySQL migration, stable row IDs, half-day leave, payroll snapshots, photo round-trip, foreign keys, unique periods, role restrictions, password handling and concurrent-save conflicts.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(root){
    if(!/^rcc_aps_validation_\d+$/.test(testDatabase) || testDatabase===originalDatabase)throw Error('Unsafe test cleanup target');
    await root.query('DROP DATABASE IF EXISTS `' + testDatabase + '`');await root.end();
  }
  process.exit(process.exitCode || 0);
});
