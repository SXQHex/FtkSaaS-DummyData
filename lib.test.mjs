import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConnection, buildPlan, projectModel } from './lib.mjs';
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
