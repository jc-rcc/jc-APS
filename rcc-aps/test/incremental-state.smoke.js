const assert=require('assert/strict');
const {incrementalConnection,sqlDate}=require('../server/db/state-writer');
const statements=[];
const raw={beginTransaction:async()=>{},rollback:async()=>{},release(){},commit:async()=>{},query:async(sql,params=[])=>{
  statements.push({sql,params});
  if(sql.startsWith('SELECT * FROM `users`'))return [[{id:1,email:'one@test.local',salary:'20000.00'}]];
  if(sql.startsWith('SELECT * FROM `profiles`'))return [[{id:1,empPhone:'old'},{id:2,empPhone:'two'}]];
  return [[]];
}};
(async()=>{
 const c=incrementalConnection(raw);await c.beginTransaction();
 await c.query('INSERT INTO users (id,email,salary) VALUES (?,?,?)',[1,'one@test.local',20000]);
 await c.query('INSERT INTO profiles (id,empPhone) VALUES (?,?)',[1,'new']);
 await c.commit();
 assert.equal(statements.filter(row=>row.sql.startsWith('UPDATE `users`')).length,0);
 assert.equal(statements.filter(row=>row.sql.startsWith('UPDATE `profiles`')).length,1);
 const deletions=statements.filter(row=>row.sql.startsWith('DELETE'));
 assert.equal(deletions.length,1);assert.match(deletions[0].sql,/WHERE `id` <=> \?/);assert.deepEqual(deletions[0].params,[2]);
 assert.equal(sqlDate('Oct 20, 2026'),'2026-10-20');assert.equal(sqlDate('2026-02-28'),'2026-02-28');assert.equal(sqlDate(''),null);assert.throws(()=>sqlDate('2026-02-30'));
 console.log('PASS: unchanged monetary rows skipped, changed records updated by key, only explicitly removed rows deleted, and dates validated.');
})().catch(error=>{console.error(error);process.exitCode=1;});
