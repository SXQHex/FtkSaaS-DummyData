import pg from 'pg';
import { SeedPg } from '@snaplet/seed/adapter-pg';
import { defineConfig } from '@snaplet/seed/config';
import { validateConnection } from './lib.mjs';

export default defineConfig({
  adapter: async () => {
    const testing = process.env.SNAPLET_LOCAL_TEST === '1';
    const connectionString = validateConnection(process.env.SNAPLET_DATABASE_URL, testing);
    const client = new pg.Client({
      connectionString,
      ssl: testing ? false : { rejectUnauthorized: true },
      connectionTimeoutMillis: 10000,
      options: '-c default_transaction_read_only=on -c statement_timeout=15000',
    });
    await client.connect();
    return new SeedPg(client);
  },
  alias: { inflection: false },
  // preview.mjs projects introspected scalar fields before client generation.
  // Existing parent rows are referenced explicitly, never generated.
  select: ['!*', 'core.people', 'core.person_contacts', 'core.center_relationships'],
});
