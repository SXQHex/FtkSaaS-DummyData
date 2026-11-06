import { v7 } from 'uuid';
import { readFileSync } from 'node:fs';

export const projectRef = 'gwyprhenabtpkbojephw';
export const tables = ['people', 'person_contacts', 'center_relationships'];

export function databaseTls(localTest = false) {
  if (localTest) return false;
  return {
    ca: readFileSync(new URL('./certs/supabase-root.crt', import.meta.url), 'utf8'),
    rejectUnauthorized: true,
  };
}

export function connectionFailure(error, stage) {
  const messages = {
    '28P01': 'Veritabanı parolası kabul edilmedi. Secret içindeki parolayı ve URI kodlamasını kontrol et.',
    '28000': 'Veritabanı kullanıcısı veya kimlik doğrulama ayarı reddedildi.',
    '42501': 'Bağlantı kuruldu; gerekli şema/tablo okuma yetkisi yok.',
    '42P01': 'Bağlantı kuruldu; beklenen tablo bulunamadı.',
    '42703': 'Bağlantı kuruldu; beklenen sütun bulunamadı.',
    '53300': 'Veritabanı bağlantı limiti dolu.',
    SELF_SIGNED_CERT_IN_CHAIN: 'TLS sertifika zinciri doğrulanamadı. Güvenilir CA yapılandırması gerekli.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'TLS sertifikası güvenilir değil.',
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'TLS sertifikasını doğrulayacak CA bulunamadı.',
    CERT_HAS_EXPIRED: 'TLS sertifikasının süresi dolmuş.',
    ENOTFOUND: 'Veritabanı sunucusunun DNS adı çözülemedi.',
    ECONNREFUSED: 'Veritabanı bağlantısı reddedildi.',
    ETIMEDOUT: 'Veritabanı bağlantısı zaman aşımına uğradı.',
    ECONNRESET: 'Veritabanı bağlantısı sunucu veya ağ tarafından kapatıldı.',
  };
  const code = Object.hasOwn(messages, error?.code) ? error.code : 'UNKNOWN';
  return `DB_${stage.toUpperCase()}_${code}: ${messages[code] || 'Bağlantı veya şema okuması başarısız; ham hata güvenlik nedeniyle yayımlanmadı.'}`;
}

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
  if (test) {
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Test modu yalnız loopback bağlantısını kabul eder.');
    return value;
  }
  const direct = url.hostname === `db.${projectRef}.supabase.co` && url.username === 'postgres';
  const pooled = url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${projectRef}`;
  if (!(direct || pooled) || (url.port && url.port !== '5432') || url.pathname !== '/postgres') throw new Error('Hedef proje veya session pooler portu eşleşmiyor.');
  if (!url.password || url.password.includes('YOUR-PASSWORD')) throw new Error('URI içinde veritabanı parolası doldurulmalı.');
  // TLS verification stays enabled. URL parameters must not override it.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) url.searchParams.delete(key);
  return url.toString();
}

export function buildPlan(orgId, centerId, now = new Date().toISOString(), profile = 'pilot3') {
  const profiles = {
    pilot3: ['Deniz Yılmaz', 'Ece Demir', 'Can Kaya'],
    expand7: ['Selin Arslan', 'Emre Şahin', 'Derya Aydın', 'Mert Çelik', 'İpek Koç', 'Bora Aksoy', 'Zeynep Yıldız'],
  };
  if (!Object.hasOwn(profiles, profile)) throw new Error('Bilinmeyen veri profili.');
  const people = profiles[profile].map(display_name => ({
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
