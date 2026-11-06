import pg from 'pg';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Synthetic schema tests the tool chain, not the application's business rules.
if (process.env.SNAPLET_LOCAL_TEST !== '1' || new URL(process.env.SNAPLET_DATABASE_URL).hostname !== '127.0.0.1') throw new Error('Loopback test only');
const client = new pg.Client({ connectionString: process.env.SNAPLET_DATABASE_URL });
await client.connect();
try {
  await client.query(`create schema core;
    create table core.organizations(id uuid primary key,name text not null,state text not null);
    create table core.centers(id uuid primary key,org_id uuid not null references core.organizations(id),name text not null,state text not null);
    create table core.people(id uuid primary key,created_at timestamptz not null,version bigint not null check(version>=1),org_id uuid not null references core.organizations(id),display_name text not null,given_name text,family_name text,state text not null check(state in ('active','merged')),merged_into_id uuid references core.people(id));
    create table core.person_contacts(id uuid primary key,created_at timestamptz not null,version bigint not null,org_id uuid not null references core.organizations(id),person_id uuid not null references core.people(id),kind text not null,value text not null,verified_at timestamptz,account_projection_retired boolean not null);
    create table core.center_relationships(id uuid primary key,created_at timestamptz not null,version bigint not null,org_id uuid not null references core.organizations(id),center_id uuid not null references core.centers(id),person_id uuid not null references core.people(id),kind text not null,state text not null,started_at timestamptz not null,ended_at timestamptz);
    insert into core.organizations values('019a4d00-0000-7000-8000-000000000001','Starter1','active');
    insert into core.centers values('019a4d00-0000-7000-8000-000000000002','019a4d00-0000-7000-8000-000000000001','Starter1 Merkez','active');`);
  const count = async () => (await client.query('select count(*)::int as n from core.people')).rows[0].n;
  for (const [profile, expected] of [['pilot3',3],['expand7',7]]) {
    const preview = spawnSync(process.execPath, ['preview.mjs'], { env:{...process.env,SNAPLET_PROFILE:profile}, stdio: 'inherit', timeout: 180000 });
    if (preview.status !== 0) throw new Error('Preview failed');
    if (await count() !== 0) throw new Error('dryRun wrote rows');
    const sql = readFileSync('output/preview.sql', 'utf8');
    // Execute generated statements only against this fresh loopback database.
    await client.query(sql.replace(/ROLLBACK;\s*$/, ''));
    if (await count() !== expected) throw new Error('Wrong generated row count');
    await client.query('ROLLBACK');
    if (await count() !== 0) throw new Error('Rollback did not restore empty test tables');
  }
  console.log('Native tool smoke passed: dryRun, valid SQL and rollback. This is not hosted business acceptance.');
} finally { await client.end(); }
