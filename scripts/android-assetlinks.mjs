import { mkdir, readFile, writeFile } from 'node:fs/promises';

const fingerprint = process.env.TANGO_APP_SIGNING_SHA256;
if (!/^([A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(fingerprint || '')) {
  throw new Error('Set TANGO_APP_SIGNING_SHA256 to the SHA-256 app-signing certificate fingerprint from Play Console (not the upload certificate).');
}
const path = 'public/.well-known/assetlinks.json';
const relation = 'delegate_permission/common.handle_all_urls';
let statements;
try {
  statements = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  statements = [];
}
if (!Array.isArray(statements)) {
  throw new Error('Existing assetlinks.json must be a statement array; refusing to replace it.');
}
const existing = statements.find(statement =>
  Array.isArray(statement?.relation) && statement.relation.includes(relation) &&
  statement.target?.namespace === 'android_app' &&
  statement.target.package_name === 'app.tangodj.studio');
if (existing) {
  const fingerprints = existing.target.sha256_cert_fingerprints;
  if (!Array.isArray(fingerprints) || fingerprints.some(value => typeof value !== 'string')) {
    throw new Error('Existing Tango certificate fingerprints must be an array of strings; refusing to replace them.');
  }
  if (!fingerprints.some(value => value.toUpperCase() === fingerprint.toUpperCase())) {
    fingerprints.push(fingerprint.toUpperCase());
  }
} else {
  statements.push({
    relation: [relation],
    target: { namespace: 'android_app', package_name: 'app.tangodj.studio', sha256_cert_fingerprints: [fingerprint.toUpperCase()] },
  });
}
await mkdir('public/.well-known', { recursive: true });
await writeFile(path, JSON.stringify(statements, null, 2) + '\n');
console.log('Updated public/.well-known/assetlinks.json, preserving existing statements. Deploy it at the app origin before checking verified full-screen launch.');
