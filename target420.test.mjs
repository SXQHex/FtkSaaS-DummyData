import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTarget420, asciiName, authSql } from './target420.mjs';

function target(){
 const organizations=['business','pro','pro','starter','starter','starter'].map((plan,i)=>({id:'o'+i,plan,centers:Array.from({length:plan==='business'?2:1},(_,j)=>({id:`c${i}-${j}`}))}));
 const members=organizations.flatMap(o=>o.centers.flatMap(c=>Array.from({length:60},(_,i)=>({id:c.id+'p'+i,center_id:c.id,state:i<50?'active':'inactive',relationship_id:c.id+'r'+i}))));
 return {organizations,members,owners:[],remove:[]};
}
test('each Pro stays at one center and every center has exactly 50/10',()=>{
 const p=target();validateTarget420(p);p.organizations[1].centers.push({id:'extra'});assert.throws(()=>validateTarget420(p),/center count/);
});
test('a shifted total or deleting a retained member is rejected',()=>{
 const p=target();p.members[0].state='inactive';assert.throws(()=>validateTarget420(p),/distribution/);
 const q=target();q.remove.push({id:q.members[0].relationship_id});assert.throws(()=>validateTarget420(q),/deleted member/);
});
test('Turkish name aliases are ASCII and include no numeric filler',()=>{
 assert.equal(asciiName('İpek Şahin'),'ipeksahin');assert.equal(asciiName('Çağrı GÜLER'),'cagriguler');
 const p=target();p.members[0]={...p.members[0],create_account:true,email:'fethiyetango+student001@gmail.com'};assert.throws(()=>validateTarget420(p),/aliases/);
});
test('Auth fixtures never rewrite existing credentials and require a runtime password',()=>{
 assert.throws(()=>authSql(target(),[],''),/required/);
 const sql=authSql(target(),[{create_account:false,email:'existing@example.invalid'}],'test-only-password');
 assert.ok(!sql.includes('existing@example.invalid'));assert.doesNotMatch(sql,/UPDATE auth\./i);assert.match(sql,/ACCOUNT_ALREADY_EXISTS/);assert.match(sql,/gen_salt\('bf',10\)/);
});
