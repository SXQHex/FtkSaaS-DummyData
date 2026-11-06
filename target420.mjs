import { readFileSync, writeFileSync } from 'node:fs';
import { v7 as uuid } from 'uuid';
import { fileURLToPath } from 'node:url';

// Offline reconciliation planner. Private snapshots and credentials stay in .work.
const first = 'Ada Aylin Aslı Ayşe Bahar Beren Beste Buse Ceren Damla Defne Deniz Derya Dila Ece Eda Elif Esin Ezgi Gaye Gizem Gökçe İpek Irmak İrem Melis Nazlı Nehir Nil Oya Özge Pelin Selin Sema Sıla Sueda Şule Tuğçe Yağmur Yasemin Zeynep Alp Aras Arda Baran Batu Berk Bora Burak Can Cem Cenk Doruk Efe Emre Eren Kerem Kaan Mert Onur Ozan'.split(' ');
const last = 'Acar Aksoy Arslan Aslan Aydın Başaran Bulut Çelik Çetin Demir Deniz Doğan Erdem Eren Güneş Gürsoy Işık İnce Kaplan Kara Kaya Keskin Kılıç Koç Korkmaz Özcan Özen Öztürk Polat Sağlam Sarı Şahin Şen Taş Tekin Toprak Tunç Uysal Yalçın Yıldız Yılmaz'.split(' ');
export const asciiName = value => value.replaceAll('ı','i').replaceAll('İ','I').replaceAll('ş','s').replaceAll('Ş','S').replaceAll('ğ','g').replaceAll('Ğ','G').replaceAll('ç','c').replaceAll('Ç','C').replaceAll('ö','o').replaceAll('Ö','O').replaceAll('ü','u').replaceAll('Ü','U').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z]/g,'').toLowerCase();
const quote = x => x == null ? 'NULL' : "'"+String(x).replaceAll("'","''")+"'";
const data = x => `${quote(JSON.stringify(x))}::jsonb`;
const ids = xs => xs.length ? xs.map(quote).join(',') : 'NULL';

export function buildTarget420(before, context) {
  const existing = name => { const a=before.organizations.filter(o=>o.name===name); if(a.length!==1) throw Error('Expected one organization: '+name);return a[0]; };
  const business=existing('Fethiye Tango Kulübü'),pro=existing('Pro1'),starter=existing('Starter1'),unused=existing('S04 Yetkisiz Tenant Testi 20261102');
  if(before.organizations.length!==4) throw Error('Organization inventory changed');
  const definitions=[[business,'business',2],[pro,'pro',1],[starter,'starter',1],[unused,'starter',1]];
  const organizations=definitions.map(([o,plan,n])=>({...o,plan,existing:true,expected_name:o.name,name:o.id===unused.id?'Starter2':o.name,centers:before.centers.filter(c=>c.org_id===o.id)}));
  if(definitions.some(([o,,n])=>before.centers.filter(c=>c.org_id===o.id&&c.state==='active').length!==n)) throw Error('Center inventory changed');
  for (const [name,plan] of [['Pro2','pro'],['Starter3','starter']]) {
    const id=uuid(),center=uuid();organizations.push({id,org_id:id,name,plan,existing:false,owner_person_id:uuid(),state:'active',centers:[{id:center,center_id:center,org_id:id,name:name+' Merkez',timezone:'Europe/Istanbul',state:'active',existing:false}]});
  }
  for(const o of organizations) for(const c of o.centers) if(c.existing!==false){c.existing=true;c.expected_name=c.name;if(o.id===unused.id)c.name='Starter2 Merkez';if(o.id===pro.id){c.name='Pro1 Merkez';c.timezone='Europe/Istanbul';}}
  const used=new Set(before.people.filter(p=>!/^S0[234]|^P14 /.test(p.display_name)).map(p=>asciiName(p.display_name.replace(/^Demo /,''))));
  const pool=[];for(let j=0;j<last.length;j++)for(let i=0;i<first.length;i++)pool.push(first[(i+j*7)%first.length]+' '+last[j]);
  let next=0;const nextName=()=>{while(next<pool.length){const n=pool[next++],key=asciiName(n);if(!used.has(key)){used.add(key);return n;}}throw Error('Name pool exhausted');};
  const links=new Map(context.links.map(l=>[l.person_id,l.account_id]));
  const people=new Map(before.people.map(p=>[p.id,p]));
  const dependencyIds=new Set(context.dependencies.map(x=>x.pid));
  const members=[],remove=[],reactivate=[];
  for(const o of organizations)for(const c of o.centers){
    const rels=before.relationships.filter(r=>r.center_id===c.id&&r.kind==='student');
    const active=rels.filter(r=>r.state==='active');
    if(active.some(r=>people.get(r.person_id)?.state!=='active')||active.length>50)throw Error('Invalid existing active members');
    const inactive=rels.filter(r=>r.state==='inactive').sort((a,b)=>Number(dependencyIds.has(b.person_id))-Number(dependencyIds.has(a.person_id))||a.id.localeCompare(b.id));
    const validInactive=inactive.filter(r=>people.get(r.person_id)?.state==='active');
    const kept=validInactive.slice(0,10);
    const reuse=validInactive.slice(10).filter(r=>!dependencyIds.has(r.person_id)).slice(0,50-active.length);
    const keepIds=new Set([...active,...kept,...reuse].map(r=>r.id));
    for(const r of rels)if(!keepIds.has(r.id)){
      // Do not discard a non-merged student's dependent operational history.
      if(people.get(r.person_id)?.state==='active'&&dependencyIds.has(r.person_id))throw Error('Dependent inactive row needs review');
      remove.push(r);
    }
    const push=(r,state)=>{const p=people.get(r.person_id);members.push({id:p.id,org_id:o.id,center_id:c.id,relationship_id:r.id,state,existing:true,old_state:r.state,old_person_state:p.state,old_name:p.display_name,display_name:links.has(p.id)?p.display_name:/^Demo /.test(p.display_name)?p.display_name.slice(5):/^S0[234]|^P14 /.test(p.display_name)?nextName():p.display_name,account_id:links.get(p.id)||null,started_at:r.started_at,ended_at:r.ended_at});};
    for(const r of active)push(r,'active');for(const r of kept)push(r,'inactive');for(const r of reuse){push(r,'active');reactivate.push(r.id);}
    for(const state of ['active','inactive']){
      const n=(state==='active'?50:10)-members.filter(m=>m.center_id===c.id&&m.state===state).length;
      for(let k=0;k<n;k++)members.push({id:uuid(),org_id:o.id,center_id:c.id,relationship_id:uuid(),state,existing:false,display_name:nextName(),account_id:null});
    }
  }
  const owners=organizations.filter(o=>!o.existing||o.id===unused.id).map(o=>({id:o.owner_person_id,org_id:o.id,center_id:o.centers[0].id,existing:o.existing,display_name:nextName(),account_id:null,owner:true}));
  for(const m of [...members,...owners])if(!m.account_id){const names=m.display_name.split(' ');m.given_name=names.slice(0,-1).join(' ');m.family_name=names.at(-1);m.email='fethiyetango+'+asciiName(m.display_name)+'@gmail.com';m.auth_id=uuid();m.account_id=uuid();m.link_id=uuid();m.create_account=true;}
  const plan={version:1,project_ref:'gwyprhenabtpkbojephw',organizations,members,owners,remove,reactivate,created_at:new Date().toISOString()};
  validateTarget420(plan);return plan;
}

export function validateTarget420(p){
  if(p.organizations.length!==6||p.members.length!==420)throw Error('Wrong population');
  const counts={starter:0,pro:0,business:0};const cs=[];
  for(const o of p.organizations){counts[o.plan]++;if(o.centers.length!==(o.plan==='business'?2:1))throw Error('Invalid center count');for(const c of o.centers){cs.push(c.id);for(const [state,n] of [['active',50],['inactive',10]])if(p.members.filter(m=>m.center_id===c.id&&m.state===state).length!==n)throw Error('Wrong member distribution');}}
  if(counts.starter!==3||counts.pro!==2||counts.business!==1||new Set(cs).size!==7)throw Error('Wrong plan distribution');
  const accounts=[...p.members,...p.owners].filter(m=>m.create_account);
  if(new Set(accounts.map(m=>m.email)).size!==accounts.length||accounts.some(m=>!/^fethiyetango\+[a-z]+@gmail\.com$/.test(m.email)))throw Error('Invalid generated aliases');
  if(new Set(p.members.map(m=>m.id)).size!==420||p.remove.some(r=>p.members.some(m=>m.relationship_id===r.id)))throw Error('Duplicate/deleted member');
}

export function structureSql(p){
  const plans={starter:'01a19b15-5f5a-7c4f-98a4-5b90cbd84114',pro:'01a19b15-5f5a-7c84-89e1-cdfa46642eba'};
  let sql="BEGIN;SET LOCAL statement_timeout='30s';SET LOCAL lock_timeout='5s';SET CONSTRAINTS ALL DEFERRED;\nDO $seed$ DECLARE n int; BEGIN\n";
  sql+=`PERFORM 1 FROM core.organizations ORDER BY id FOR UPDATE;IF (SELECT count(*) FROM core.organizations)<>4 THEN RAISE EXCEPTION 'ORGANIZATION_INVENTORY_CHANGED';END IF;\n`;
  for(const o of p.organizations){
    if(o.existing){sql+=`IF NOT EXISTS(SELECT 1 FROM core.organizations WHERE id=${quote(o.id)} AND name=${quote(o.expected_name)} AND state='active') THEN RAISE EXCEPTION 'ORGANIZATION_CHANGED';END IF;\n`;if(o.name!==o.expected_name)sql+=`UPDATE core.organizations SET name=${quote(o.name)},version=version+1 WHERE id=${quote(o.id)};\n`;}
    else sql+=`INSERT INTO core.organizations(id,org_id,name,owner_person_id,state) VALUES(${quote(o.id)},${quote(o.id)},${quote(o.name)},${quote(o.owner_person_id)},'active');\nINSERT INTO core.people(id,org_id,display_name,state) VALUES(${quote(o.owner_person_id)},${quote(o.id)},${quote(p.owners.find(m=>m.id===o.owner_person_id).display_name)},'active');\n`;
    if(!o.existing||o.expected_name.startsWith('S04 '))sql+=`INSERT INTO core.saas_subscriptions(id,org_id,plan_version_id,state,starts_at,period_end,grace_until,cancel_at_period_end) VALUES((private.ops_uuid_bank(1))[1],${quote(o.id)},${quote(plans[o.plan])},'active',now(),now()+interval '1 month',now()+interval '1 month 7 days',false);\n`;
    sql+=`IF private.current_plan_name(${quote(o.id)}) IS DISTINCT FROM ${quote(o.plan)} THEN RAISE EXCEPTION 'PLAN_CHANGED';END IF;\n`;
    for(const c of o.centers)if(c.existing){sql+=`IF NOT EXISTS(SELECT 1 FROM core.centers WHERE id=${quote(c.id)} AND name=${quote(c.expected_name)} AND org_id=${quote(o.id)} AND state='active') THEN RAISE EXCEPTION 'CENTER_CHANGED';END IF;\n`;if(c.name!==c.expected_name)sql+=`UPDATE core.centers SET name=${quote(c.name)},timezone=${quote(c.timezone)},version=version+1 WHERE id=${quote(c.id)};\n`;}
    else sql+=`INSERT INTO core.centers(id,center_id,org_id,name,timezone,state) VALUES(${quote(c.id)},${quote(c.id)},${quote(o.id)},${quote(c.name)},'Europe/Istanbul','active');\n`;
  }
  sql+="SET CONSTRAINTS ALL IMMEDIATE;END $seed$;COMMIT;\n";return sql;
}

export function centerSql(p,center){
 const members=p.members.filter(m=>m.center_id===center),removed=p.remove.filter(r=>r.center_id===center),org=members[0].org_id;
 const before=p.members.filter(m=>m.center_id===center&&m.existing).length+removed.length;
 const records=members.map(({id,org_id,center_id,relationship_id,state,existing,old_state,old_person_state,display_name,create_account,given_name,family_name})=>({id,org_id,center_id,relationship_id,state,existing,old_state,old_person_state,display_name,create_account,given_name,family_name}));
 return `BEGIN;SET LOCAL statement_timeout='45s';SET LOCAL lock_timeout='5s';
DO $seed$ DECLARE m record;before_outbox bigint; BEGIN
 PERFORM 1 FROM core.organizations WHERE id=${quote(org)} FOR UPDATE;
 IF (SELECT count(*) FROM core.center_relationships WHERE center_id=${quote(center)} AND kind='student')<>${before} THEN RAISE EXCEPTION 'MEMBER_INVENTORY_CHANGED';END IF;
 SELECT count(*) INTO before_outbox FROM core.outbox_jobs WHERE org_id=${quote(org)};
 ${removed.map(r=>`IF NOT EXISTS(SELECT 1 FROM core.center_relationships WHERE id=${quote(r.id)} AND person_id=${quote(r.person_id)} AND center_id=${quote(center)} AND state='inactive' AND kind='student') THEN RAISE EXCEPTION 'REMOVAL_ROW_CHANGED';END IF;`).join('\n')}
 ${removed.length?`DELETE FROM core.center_relationships WHERE id IN (${ids(removed.map(r=>r.id))}) AND center_id=${quote(center)} AND kind='student' AND state='inactive';`:''}
 FOR m IN SELECT * FROM jsonb_to_recordset(${data(records)}) AS x(id uuid,org_id uuid,center_id uuid,relationship_id uuid,state text,existing boolean,old_state text,old_person_state text,display_name text,create_account boolean,given_name text,family_name text) LOOP
  IF m.existing THEN
   IF NOT EXISTS(SELECT 1 FROM core.people WHERE id=m.id AND org_id=m.org_id AND state='active') OR NOT EXISTS(SELECT 1 FROM core.center_relationships WHERE id=m.relationship_id AND person_id=m.id AND state=m.old_state) THEN RAISE EXCEPTION 'EXISTING_MEMBER_CHANGED';END IF;
   IF m.create_account THEN UPDATE core.people SET display_name=m.display_name,given_name=m.given_name,family_name=m.family_name,version=version+1 WHERE id=m.id;END IF;
   UPDATE core.center_relationships SET state=m.state,started_at=CASE WHEN m.old_state='inactive' AND m.state='active' THEN now() ELSE started_at END,ended_at=CASE WHEN m.state='active' THEN NULL ELSE coalesce(ended_at,now()-interval '14 days') END,version=version+1 WHERE id=m.relationship_id;
  ELSE
   INSERT INTO core.people(id,created_at,org_id,display_name,given_name,family_name,state) VALUES(m.id,now()-interval '180 days',m.org_id,m.display_name,m.given_name,m.family_name,'active');
   INSERT INTO private.person_origins(org_id,person_id,center_id) VALUES(m.org_id,m.id,m.center_id);
   INSERT INTO core.center_relationships(id,created_at,org_id,center_id,person_id,kind,state,started_at,ended_at) VALUES(m.relationship_id,now()-interval '150 days',m.org_id,m.center_id,m.id,'student',m.state,now()-interval '150 days',CASE WHEN m.state='inactive' THEN now()-interval '30 days' END);
  END IF;
 END LOOP;
 SET CONSTRAINTS ALL IMMEDIATE;
 IF (SELECT count(*) FROM core.center_relationships WHERE center_id=${quote(center)} AND kind='student' AND state='active')<>50 OR (SELECT count(*) FROM core.center_relationships WHERE center_id=${quote(center)} AND kind='student' AND state='inactive')<>10 THEN RAISE EXCEPTION 'TARGET_COUNTS_WRONG';END IF;
 IF EXISTS(SELECT 1 FROM core.center_relationships WHERE center_id=${quote(center)} AND kind='student' AND ((state='active' AND ended_at IS NOT NULL) OR (state='inactive' AND (ended_at IS NULL OR ended_at<started_at)))) THEN RAISE EXCEPTION 'INVALID_MEMBERSHIP_DATES';END IF;
 IF (SELECT count(*) FROM core.outbox_jobs WHERE org_id=${quote(org)})<>before_outbox THEN RAISE EXCEPTION 'UNEXPECTED_NOTIFICATION';END IF;
END $seed$;COMMIT;`;
}

export function authSql(p,records,password){
 if(!password||password.length<8)throw Error('SEED_USER_PASSWORD is required');
 // Native email Auth fixtures, never JWT fabrication or Auth settings changes.
 const rows=records.filter(m=>m.create_account).map(({id,org_id,center_id,display_name,given_name,family_name,email,auth_id,account_id,link_id,owner})=>({id,org_id,center_id,display_name,given_name,family_name,email,auth_id,account_id,link_id,owner:!!owner}));
 return `BEGIN;SET LOCAL statement_timeout='90s';SET LOCAL lock_timeout='5s';
DO $seed$ DECLARE m record;BEGIN
 FOR m IN SELECT * FROM jsonb_to_recordset(${data(rows)}) AS x(id uuid,org_id uuid,center_id uuid,display_name text,given_name text,family_name text,email text,auth_id uuid,account_id uuid,link_id uuid,owner boolean) LOOP
  IF EXISTS(SELECT 1 FROM core.account_links WHERE org_id=m.org_id AND person_id=m.id AND state='active') OR EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=m.email OR id=m.auth_id) THEN RAISE EXCEPTION 'ACCOUNT_ALREADY_EXISTS';END IF;
  INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at)
   VALUES('00000000-0000-0000-0000-000000000000',m.auth_id,'authenticated','authenticated',m.email,extensions.crypt(${quote(password)},extensions.gen_salt('bf',10)),now(),'','','','',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('display_name',m.display_name,'given_name',m.given_name,'family_name',m.family_name,'seed_dataset','target420'),false,now(),now());
  INSERT INTO auth.identities(id,provider_id,user_id,identity_data,provider,created_at,updated_at) VALUES(gen_random_uuid(),m.auth_id::text,m.auth_id,jsonb_build_object('sub',m.auth_id::text,'email',m.email,'email_verified',true,'phone_verified',false),'email',now(),now());
  INSERT INTO core.accounts(id,auth_user_id,state) VALUES(m.account_id,m.auth_id,'active');
  INSERT INTO private.account_identity_names(account_id,given_name,family_name) VALUES(m.account_id,m.given_name,m.family_name);
  INSERT INTO core.account_links(id,org_id,account_id,person_id,state,verified_at) VALUES(m.link_id,m.org_id,m.account_id,m.id,'active',now());
  IF m.owner THEN INSERT INTO core.role_assignments(id,org_id,person_id,role,scope_center_id,state,account_link_id) VALUES((private.ops_uuid_bank(1))[1],m.org_id,m.id,'center_manager',m.center_id,'active',m.link_id);END IF;
  IF NOT EXISTS(SELECT 1 FROM private.account_contact_projections WHERE org_id=m.org_id AND person_id=m.id AND account_id=m.account_id AND kind='email') THEN RAISE EXCEPTION 'CONTACT_PROJECTION_MISSING';END IF;
 END LOOP;
 SET CONSTRAINTS ALL IMMEDIATE;
END $seed$;COMMIT;`;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const folder=process.argv[2]||'.work/target420';
 const plan=buildTarget420(JSON.parse(readFileSync(folder+'/before.json')),JSON.parse(readFileSync(folder+'/context.json')));
 writeFileSync(folder+'/plan.json',JSON.stringify(plan,null,2),{mode:0o600});
 writeFileSync(folder+'/structure.sql',structureSql(plan),{mode:0o600});
 for(const [i,c]of plan.organizations.flatMap(o=>o.centers).entries())writeFileSync(folder+`/center-${i}.sql`,centerSql(plan,c.id),{mode:0o600});
 console.log(JSON.stringify({organizations:plan.organizations.map(o=>({name:o.name,plan:o.plan,centers:o.centers.length})),members:plan.members.length,new_members:plan.members.filter(m=>!m.existing).length,reactivated:plan.reactivate.length,removed_relationships:plan.remove.length,new_accounts:[...plan.members,...plan.owners].filter(m=>m.create_account).length}));
}
