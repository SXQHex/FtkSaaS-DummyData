import pg from 'pg';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateConnection, buildPlan, projectModel, tables } from './lib.mjs';

async function main() {
  const testing = process.env.SNAPLET_LOCAL_TEST === '1';
  const connectionString = validateConnection(process.env.SNAPLET_DATABASE_URL, testing);
  process.env.SNAPLET_DATABASE_URL = connectionString;
  const client = new pg.Client({ connectionString, ssl: testing ? false : { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
  let plan, schemaHash;
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='15s'");
    const target = await client.query(`select o.id as org_id,c.id as center_id from core.organizations o join core.centers c on c.org_id=o.id where o.name='Starter1' and c.name='Starter1 Merkez' and o.state='active' and c.state='active'`);
    if (target.rowCount !== 1) throw new Error('Starter1 / Starter1 Merkez tek aktif hedef olarak bulunamadı.');
    const { org_id, center_id } = target.rows[0];
    const schema = await client.query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='core' and table_name=any($1) order by table_name,ordinal_position", [tables]);
    schemaHash = createHash('sha256').update(JSON.stringify(schema.rows)).digest('hex');
    plan = buildPlan(org_id, center_id);
    for (const table of tables) {
      const columns = schema.rows.filter(c => c.table_name === table);
      if (!columns.length) throw new Error('Pilot tablosu eksik.');
      for (const row of plan[table]) {
        if (Object.keys(row).some(k => !columns.some(c => c.column_name === k))) throw new Error('Pilot alanları güncel şemayla eşleşmiyor.');
        if (columns.some(c => c.is_nullable === 'NO' && !c.column_default && row[c.column_name] == null)) throw new Error('Zorunlu pilot alanı eksik.');
      }
    }
    await client.query('ROLLBACK');
  } catch (error) {
    // Do not forward pg errors, connection strings or existing row contents.
    if (error.message?.startsWith('Starter1') || error.message?.startsWith('Pilot') || error.message?.startsWith('Zorunlu')) throw error;
    throw new Error('Veritabanı bağlantısı/şema kontrolü başarısız; bağlantı, TLS ve erişim ayarlarını kontrol et.');
  } finally { await client.end().catch(() => {}); }
  mkdirSync('.snaplet', { recursive: true });
  mkdirSync('.work', { recursive: true });
  mkdirSync('output', { recursive: true });
  writeFileSync('.snaplet/config.json', JSON.stringify({ adapter: 'pg' }));
  writeFileSync('.work/plan.json', JSON.stringify(plan), { mode: 0o600 });
  const env = { ...process.env, OPENAI_API_KEY: '', GROQ_API_KEY: '', SNAPLET_SEED_CONFIG: `${process.cwd()}/seed.config.ts` };
  const sync = spawnSync('./node_modules/.bin/snaplet-seed', ['introspect'], { env, encoding: 'utf8', timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  if (sync.status !== 0) {
    if (testing) console.error(sync.stdout, sync.stderr);
    throw new Error('Snaplet şema eşitlemesi başarısız; hosted ham çıktı yayımlanmadı.');
  }
  const model = projectModel(JSON.parse(readFileSync('.snaplet/dataModel.json', 'utf8')));
  writeFileSync('.snaplet/dataModel.json', JSON.stringify(model));
  const codegen = spawnSync('./node_modules/.bin/snaplet-seed', ['generate', '--output', '.generated'], { env, encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  if (codegen.status !== 0) {
    if (testing) console.error(codegen.stdout, codegen.stderr);
    throw new Error('Snaplet client üretimi başarısız.');
  }
  const generated = spawnSync(process.execPath, ['seed-child.mjs'], { env, encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  if (generated.status !== 0 || !generated.stdout.includes('INSERT INTO')) {
    if (testing) console.error(generated.stdout, generated.stderr);
    throw new Error('Snaplet SQL üretimi başarısız; hosted ham çıktı yayımlanmadı.');
  }
  const sql = generated.stdout;
  const inserts = [...sql.matchAll(/INSERT INTO\s+"?([^".\s]+)"?\."?([^"\s(]+)"?/g)];
  if (inserts.length !== 3 || inserts.some(m => m[1] !== 'core' || !tables.includes(m[2])) || /\b(TRUNCATE|DELETE|UPDATE|ALTER|DROP|CREATE)\b/i.test(sql)) throw new Error('Beklenen üç ekleme dışındaki SQL reddedildi.');
  const wrapped = `-- Snaplet dryRun; NOT executed. Review trigger and quota effects before loading.\nBEGIN;\n${sql}\nSET CONSTRAINTS ALL IMMEDIATE;\nROLLBACK;\n`;
  writeFileSync('output/preview.sql', wrapped);
  writeFileSync('output/manifest.json', JSON.stringify({ mode: 'dryRun', database_written: false, schema_sha256: schemaHash, sql_sha256: createHash('sha256').update(wrapped).digest('hex'), rows: plan }, null, 2));
  console.log('SQL önizlemesi hazır: 3 kişi, 3 iletişim, 3 öğrencilik. Veritabanına yazılmadı.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
