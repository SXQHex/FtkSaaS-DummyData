import { createSeedClient } from './.generated/index.js';
import { readFileSync } from 'node:fs';
import { tables } from './lib.mjs';

try {
  const plan = JSON.parse(readFileSync('.work/plan.json', 'utf8'));
  const seed = await createSeedClient({ dryRun: true });
  // One plan per table; explicit IDs prevent random foreign-key reassignment.
  for (const table of tables) {
    if (typeof seed[table] !== 'function') throw new Error('MODEL_NOT_FOUND');
    await seed[table](plan[table]);
  }
  process.exit(0);
} catch (error) {
  if (process.env.SNAPLET_LOCAL_TEST === '1') console.error(error);
  console.error('SNAPLET_GENERATION_FAILED');
  process.exit(1);
}
