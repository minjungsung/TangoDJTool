import { mkdir, writeFile } from 'node:fs/promises';

const fingerprint = process.env.TANGO_APP_SIGNING_SHA256;
if (!/^([A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(fingerprint || '')) {
  throw new Error('Set TANGO_APP_SIGNING_SHA256 to the SHA-256 app-signing certificate fingerprint from Play Console (not the upload certificate).');
}
const statements = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: { namespace: 'android_app', package_name: 'app.tangodj.studio', sha256_cert_fingerprints: [fingerprint.toUpperCase()] },
}];
await mkdir('public/.well-known', { recursive: true });
await writeFile('public/.well-known/assetlinks.json', JSON.stringify(statements, null, 2) + '\n');
console.log('Created public/.well-known/assetlinks.json. Deploy it at the app origin before checking verified full-screen launch.');
