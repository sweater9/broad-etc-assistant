import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { refreshMarket } from './market-data-core.mjs';
const dir = new URL('../data/', import.meta.url);
const out = new URL('market-history.json', dir);
let previous;
try { previous = JSON.parse(await readFile(out, 'utf8')); } catch {}
const { status, payload, successful } = await refreshMarket(previous);
await mkdir(dir, { recursive: true });
async function atomicWrite(url, value) {
  const temporary = new URL(url.href + '.tmp');
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(temporary, url);
}
// Persist successes even if a different instrument failed, and keep structurally
// valid older series explicitly stale. Never relabel a cached series as fresh.
if (Object.keys(payload.symbols).length) await atomicWrite(out, payload);
await atomicWrite(new URL('market-update-status.json', dir), status);
console.log(JSON.stringify(status));
if (!successful) {
  console.error('Market refresh incomplete; retained available history. See data/market-update-status.json.');
  process.exitCode = 1;
}
