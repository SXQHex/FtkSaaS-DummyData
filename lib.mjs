import { v7 } from 'uuid';

export const projectRef = 'gwyprhenabtpkbojephw';
export const tables = ['people', 'person_contacts', 'center_relationships'];

// This is an INSERT-only generation projection, not a replacement DB schema.
// All IDs and FK columns are supplied explicitly; PostgreSQL retains its FKs.
export function projectModel(raw) {
  const models = {};
  for (const table of tables) {
    const match = Object.values(raw.models).filter(m => m.schemaName === 'core' && m.tableName === table);
    if (match.length !== 1) throw new Error('Pilot modeli bulunamadı.');
    const model = match[0];
    models[table] = { ...model, fields: model.fields.filter(f => f.kind === 'scalar') };
  }
  return { ...raw, models };
}

export function validateConnection(value, test = false) {
  if (!value) throw new Error('SNAPLET_DATABASE_URL eksik.');
  let url;
  try { url = new URL(value); } catch { throw new Error('PostgreSQL URI geçersiz.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URI gerekli; HTTPS proje adresi değil.');
  if (test && ['127.0.0.1', 'localhost'].includes(url.hostname)) return value;
  const direct = url.hostname === `db.${projectRef}.supabase.co` && url.username === 'postgres';
  const pooled = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${projectRef}`;
  if (!(direct || pooled) || (url.port && url.port !== '5432') || url.pathname !== '/postgres') throw new Error('Hedef proje veya session pooler portu eşleşmiyor.');
  if (!url.password || url.password.includes('YOUR-PASSWORD')) throw new Error('URI içinde veritabanı parolası doldurulmalı.');
  // TLS verification stays enabled. URL parameters must not override it.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) url.searchParams.delete(key);
  return url.toString();
}

export function buildPlan(orgId, centerId, now = new Date().toISOString()) {
  const people = ['Deniz Yılmaz', 'Ece Demir', 'Can Kaya'].map(display_name => ({
    id: v7(), created_at: now, version: 1, org_id: orgId,
    display_name: `Demo ${display_name}`, given_name: null, family_name: null,
    state: 'active', merged_into_id: null,
  }));
  const contacts = people.map((p, i) => ({
    id: v7(), created_at: now, version: 1, org_id: orgId, person_id: p.id,
    kind: 'email', value: `snaplet-${p.id}-${i}@example.invalid`,
    verified_at: null, account_projection_retired: false,
  }));
  const relationships = people.map(p => ({
    id: v7(), created_at: now, version: 1, org_id: orgId, center_id: centerId,
    person_id: p.id, kind: 'student', state: 'active', started_at: now, ended_at: null,
  }));
  return { people, person_contacts: contacts, center_relationships: relationships };
}
