const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const storage=new Map();const messages=[];
const base={users:[{id:3,first:'Employee',last:'Test',email:'employee@test.local',role:'Employee',status:'Active'}],profiles:{3:{photo:'data:image/jpeg;base64,AQID'}},auth:{},stateRevision:7,payrollRecords:[],cashAdvances:{},bonusTypes:[],bonusPayouts:{},leaveTypes:[],leaveRecords:[],attendance:[],teacherRanks:[],teachingLoadRecords:[],teachingLoadClasses:[],deductionCategories:[],sssTable:[],birData:[],philData:{},pagData:{},workDays:22,hoursPerWorkload:3,nextUserId:4,nextBonusId:1,nextDedCatId:1,nextLeaveTypeId:1,nextLeaveRecordId:1,nextRankId:1,nextTeachingLoadId:1,nextTeachingLoadClassId:1};
storage.set('rcc_aps_demo_v1',JSON.stringify({...base,users:[{id:1,salary:99999},{id:3}],auth:{1:{pass:'legacy-secret'}},savedAt:'2099-01-01'}));
let posted,failConflict=false;
const ctx=vm.createContext({console,loggedInUser:{id:3,role:'employee'},document:{addEventListener(){},getElementById(){return null;}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},getAuthToken:()=> 'test-token',clearAuthToken(){},showToast:(...message)=>messages.push(message),fetch:async(url,options)=>{
 if(options.method==='POST'){
  posted=JSON.parse(options.body);
  if(failConflict)return {ok:false,status:409,json:async()=>({error:'Records changed. Reload.'})};
  return {ok:true,status:200,json:async()=>({state:{...base,stateRevision:8,profiles:posted.profiles}})};
 }
 return {ok:true,status:200,json:async()=>structuredClone(base)};
},structuredClone});
vm.runInContext(fs.readFileSync(__dirname+'/../public/js/core.js','utf8'),ctx);
for(const name of ['users','cashAdvances','bonusTypes','deductionCategories','payrollRecords','bonusPayouts','sssTable','philData','pagData','birData','dedMeta','LEAVE_TYPES','LEAVE_RECORDS','ATTENDANCE','teacherRanks','teachingLoadRecords','teachingLoadClasses'])ctx[name]=name==='users'?[{id:1,salary:99999},{id:3}]:name.endsWith('Data')||['cashAdvances','bonusPayouts','dedMeta'].includes(name)?{}:[];
for(const name of ['nextUserId','nextBonusId','nextDedCatId','NEXT_LEAVE_TYPE_ID','nextLeaveRecordId','nextRankId','nextTeachingLoadId','nextTeachingLoadClassId'])ctx[name]=1;
ctx.WORK_DAYS=22;ctx.HOURS_PER_WORKLOAD=3;ctx.BONUS_EXEMPTION_LIMIT=90000;
const payroll=fs.readFileSync(__dirname+'/../public/js/payroll.js','utf8');
vm.runInContext(payroll.match(/function applyServerData[\s\S]*?\n}/)[0],ctx);
(async()=>{
 assert.equal(await vm.runInContext('syncDemo()',ctx),true);
 assert.deepEqual(ctx.users.map(user=>user.id),[3]);assert.equal(posted,undefined,'Local future timestamps must never overwrite server data');
 vm.runInContext("ensureAuth(users[0],'pending-secret'); PROFILES[3].empPhone='0917'",ctx);
 assert.equal(await vm.runInContext('saveDemo()',ctx),true);
 assert.equal(posted.stateRevision,7);assert.equal(posted.auth.u3.pass,'pending-secret');
 const cached=JSON.parse(storage.get('rcc_aps_demo_v1'));assert.deepEqual(cached.auth,{});assert.equal(cached.stateRevision,8);assert.equal(cached.profiles[3].photo,'data:image/jpeg;base64,AQID');
 failConflict=true;assert.equal(await vm.runInContext('saveDemo()',ctx),false);assert.match(messages.at(-1)[1],/Records changed/);
 console.log('PASS: server-scoped login hydration, stale cache cannot upload itself, revisions sent/updated, credentials excluded from cache, photos preserved and conflicts surfaced.');
})().catch(error=>{console.error(error);process.exitCode=1;});
