import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConnection, buildPlan, projectModel, connectionFailure, databaseTls } from './lib.mjs';
import { X509Certificate } from 'node:crypto';
import { validate, version } from 'uuid';

test('wrong project, HTTPS URL and transaction pooler are rejected', () => {
  for (const uri of [undefined, 'https://gwyprhenabtpkbojephw.supabase.co', 'postgresql://postgres:demo@db.other.supabase.co/postgres', 'postgresql://postgres.gwyprhenabtpkbojephw:demo@aws-0-test.pooler.supabase.com:6543/postgres']) assert.throws(() => validateConnection(uri));
});
test('target session pooler accepted; URL TLS overrides removed', () => {
  const uri = validateConnection('postgresql://postgres.gwyprhenabtpkbojephw:demo@aws-0-test.pooler.supabase.com:5432/postgres?sslmode=no-verify');
  assert.equal(new URL(uri).searchParams.has('sslmode'), false);
});
test('pilot uses distinct v7 IDs, exact tenant and center, valid student semantics', () => {
  const plan = buildPlan('org-test', 'center-test', '2026-11-06T12:00:00.000Z');
  const rows = Object.values(plan).flat();
  assert.equal(rows.length, 9);
  assert.equal(new Set(rows.map(r => r.id)).size, 9);
  for (const r of rows) { assert.ok(validate(r.id)); assert.equal(version(r.id), 7); assert.equal(r.org_id, 'org-test'); assert.equal(r.version, 1); }
  for (const r of plan.center_relationships) { assert.equal(r.kind, 'student'); assert.equal(r.state, 'active'); assert.equal(r.center_id, 'center-test'); assert.equal(r.ended_at, null); assert.ok(plan.people.some(p => p.id === r.person_id)); }
  for (const r of plan.person_contacts) { assert.ok(r.value.endsWith('@example.invalid')); assert.equal(r.verified_at, null); assert.ok(plan.people.some(p => p.id === r.person_id)); }
});
test('generation projection preserves scalars and does not auto-generate FK parents', () => {
  const raw = { models: Object.fromEntries(['people','person_contacts','center_relationships','organizations'].map(table => [table, { schemaName: 'core', tableName: table, fields: [{name:'org_id',kind:'scalar',isRequired:true},{name:'parent',kind:'object',type:'organizations'}], uniqueConstraints: [] }])) };
  const projected = projectModel(raw);
  assert.deepEqual(Object.keys(projected.models), ['people','person_contacts','center_relationships']);
  for (const model of Object.values(projected.models)) assert.deepEqual(model.fields, [{name:'org_id',kind:'scalar',isRequired:true}]);
  assert.equal(raw.models.people.fields.length, 2);
});
test('connection diagnosis distinguishes auth/TLS without disclosing provider text or secrets', () => {
  const sensitive = 'postgresql://user:DO_NOT_PRINT@private-host/database';
  for (const code of ['28P01','SELF_SIGNED_CERT_IN_CHAIN','42501','unknown:'+sensitive]) {
    const text = connectionFailure({code,message:sensitive,detail:sensitive}, 'connect');
    assert.equal(text.includes(sensitive), false);
    assert.equal(text.includes('DO_NOT_PRINT'), false);
  }
  assert.match(connectionFailure({code:'28P01'}, 'connect'), /DB_CONNECT_28P01/);
  assert.match(connectionFailure({code:'SELF_SIGNED_CERT_IN_CHAIN'}, 'connect'), /TLS/);
  assert.match(connectionFailure({code:'42501'}, 'schema'), /DB_SCHEMA_42501/);
});
test('hosted TLS trusts the official Supabase CA and keeps server verification enabled', () => {
  const ssl = databaseTls();
  assert.equal(ssl.rejectUnauthorized, true);
  const cert = new X509Certificate(ssl.ca);
  assert.equal(cert.ca, true);
  assert.equal(cert.fingerprint256, '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
  assert.ok(Date.parse(cert.validTo) > Date.now());
  assert.equal(ssl.checkServerIdentity, undefined); // Node's hostname verification remains active.
});
test('local test mode cannot disable hosted TLS', () => {
  assert.throws(() => validateConnection('postgresql://postgres.gwyprhenabtpkbojephw:demo@aws-1-eu-central-1.pooler.supabase.com:5432/postgres', true));
  assert.equal(validateConnection('postgresql://postgres@127.0.0.1:5432/test', true), 'postgresql://postgres@127.0.0.1:5432/test');
});
