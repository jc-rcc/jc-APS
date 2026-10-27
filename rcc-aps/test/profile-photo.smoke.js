const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const elements={};
for(const id of ['empAvatar','finAvatar','admAvatar','empProfAvatar','finProfAvatar','admProfAvatar']) elements[id]={style:{},replaceChildren(img){this.child=img;},set textContent(value){this.text=value;this.child=null;}};
const input={files:[],value:'file',click(){this.clicked=true;}};elements.profilePhotoInput=input;
let saved=0;const messages=[],draws=[],revoked=[];
class TestImage {constructor(){this.naturalWidth=800;this.naturalHeight=400;}set src(value){queueMicrotask(()=>this.onload());}}
const ctx=vm.createContext({loggedInUser:{id:3},users:[{id:3,first:'Paolo',last:'Mendoza'},{id:4,first:'Ana',last:'Reyes'}],PROFILES:{3:{empPhone:'0917',empAddr:'City'},4:{photo:'data:image/jpeg;base64,BAUG'}},document:{getElementById:id=>elements[id],querySelectorAll:()=>[],createElement:tag=>tag==='canvas'?{getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);}}),toDataURL:()=> 'data:image/jpeg;base64,AQID'}:{style:{}}},Image:TestImage,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:value=>revoked.push(value)},displayName:u=>u.first+' '+u.last,saveDemo:async()=>{saved++;return true;},showToast:(...message)=>messages.push(message),queueMicrotask});
vm.runInContext(fs.readFileSync(__dirname+'/../public/js/profile-photo.js','utf8'),ctx);
ctx.esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
assert.match(vm.runInContext('userPhotoMarkup(users[1])',ctx), /src="data:image\/jpeg;base64,BAUG"/);
ctx.PROFILES[4].photo='" onerror="alert(1)';
assert.equal(vm.runInContext('userPhotoMarkup(users[1])',ctx),'AR');
ctx.PROFILES[4].photo='data:image/jpeg;base64,BAUG';
const directorySource=fs.readFileSync(__dirname+'/../public/js/deductions.js','utf8');
assert.equal((directorySource.match(/\$\{userPhotoMarkup\(u\)\}/g)||[]).length,2);
(async()=>{
 vm.runInContext('chooseProfilePhoto()',ctx);assert.equal(input.clicked,true);
 input.files=[{type:'image/jpeg',size:1000}];
 await vm.runInContext('uploadProfilePhoto(document.getElementById("profilePhotoInput"))',ctx);
 assert.equal(saved,1);assert.equal(ctx.PROFILES[3].empPhone,'0917');assert.equal(ctx.PROFILES[3].photo,'data:image/jpeg;base64,AQID');
 assert.deepEqual(draws[0].slice(1),[200,0,400,400,0,0,256,256]);assert.equal(revoked.length,1);
 for(const id of Object.keys(elements).filter(id=>id!=='profilePhotoInput')) assert.equal(elements[id].child.src,'data:image/jpeg;base64,AQID');
 ctx.loggedInUser.id=4;vm.runInContext('renderProfilePhotos(users[1])',ctx);assert.equal(elements.empProfAvatar.child.src,'data:image/jpeg;base64,BAUG');
 ctx.PROFILES[4].photo='';vm.runInContext('renderProfilePhotos(users[1])',ctx);assert.equal(elements.empProfAvatar.child,null);assert.equal(elements.empProfAvatar.text,'AR');
 input.files=[{type:'text/html',size:20}];await vm.runInContext('uploadProfilePhoto(document.getElementById("profilePhotoInput"))',ctx);assert.equal(saved,1);
 input.files=[{type:'image/png',size:6*1024*1024}];await vm.runInContext('uploadProfilePhoto(document.getElementById("profilePhotoInput"))',ctx);assert.equal(saved,1);
 // Verify database round-trip without changing real records.
 let stored=[];
 const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,params)=>{sql=sql.replaceAll('`','');if(/INSERT INTO profiles/.test(sql))stored.push({id:params[0],empPhone:params[1],empAddr:params[2],photo:params[3]});return [[]];}};
 const pool={getConnection:async()=>connection,execute:async sql=>[sql.includes('FROM profiles')?stored:/FROM phil_data|FROM pag_data/.test(sql)?[{}]:[]]};
 const server=vm.createContext({module:{exports:{}},require:name=>name==='mysql2/promise'?{createPool:()=>pool}:name==='./db/state-writer'?require('../server/db/state-writer'):{},process:{env:{}},console});
 vm.runInContext(fs.readFileSync(__dirname+'/../server/db.js','utf8'),server);
 await server.module.exports.persistState({profiles:ctx.PROFILES});
 const state=await server.module.exports.assembleState();
 assert.equal(state.profiles[3].photo,'data:image/jpeg;base64,AQID');assert.equal(state.profiles[3].empPhone,'0917');assert.equal(state.profiles[4].photo,'');
 console.log('PASS: photo picker, JPEG crop/resize, all avatar locations, per-account isolation, file validation, contact preservation, and database round-trip.');
})().catch(error=>{console.error(error);process.exitCode=1;});
