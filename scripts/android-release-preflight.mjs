import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--check-site')) {
  console.error('Usage: node scripts/android-release-preflight.mjs [--check-site]');
  process.exit(2);
}
const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed, detail });
const read = path => readFile(join(root, path));
const fingerprintPattern = /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/;

function imageSize(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid PNG header');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Expected PNG or JPEG');
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error('Invalid JPEG segment');
    if (frameMarkers.has(marker) && length >= 7) return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    offset += length;
  }
  throw new Error('Missing JPEG frame');
}

async function appSourcePaths(directory) {
  const files = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await appSourcePaths(path));
    else if (entry.isFile() && /\.(?:js|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const gradle = (await read('android/app/build.gradle')).toString();
const packageName = /applicationId\s+['"]([^'"]+)['"]/.exec(gradle)?.[1];
const versionCode = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
const versionName = /versionName\s+['"]([^'"]+)['"]/.exec(gradle)?.[1];
const targetSdk = Number(/targetSdk\s+(\d+)/.exec(gradle)?.[1]);
const manifest = (await read('android/app/src/main/AndroidManifest.xml')).toString();
const site = /DEFAULT_URL"\s+android:value="([^"]+)"/.exec(manifest)?.[1];
check('android-identity', Boolean(packageName && versionCode > 0 && versionName && targetSdk >= 36 && site?.startsWith('https://')), 'Application ID, version, target SDK and HTTPS launch origin are configured.');

const bundlePath = 'android/app/build/outputs/bundle/release/app-release.aab';
let bundle = null;
try {
  const bytes = await read(bundlePath);
  bundle = { path: bundlePath, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  const result = spawnSync('jarsigner', ['-J-Duser.language=en', '-verify', join(root, bundlePath)], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const verified = result.status === 0 && /jar verified\./i.test(output) && !/jar is unsigned|unsigned entries|treated as unsigned|invalid signature|digest error/i.test(output);
  check('release-bundle-signature', verified, verified ? 'JAR integrity/signature verification passed; upload-certificate identity must still match Play Console.' : 'Build with the legitimate upload keystore and all four TANGO_UPLOAD_* signing variables. The current bundle is unsigned, invalid, or jarsigner is unavailable.');
} catch {
  check('release-bundle-signature', false, `Build ${bundlePath} with the legitimate upload keystore.`);
}

const expectedFingerprint = process.env.TANGO_APP_SIGNING_SHA256?.toUpperCase();
check('provider-certificate-input', fingerprintPattern.test(expectedFingerprint || ''), 'TANGO_APP_SIGNING_SHA256 must contain the full Play app-signing certificate fingerprint supplied by Play Console.');
const matchesCertificate = statements => Array.isArray(statements) && statements.some(statement =>
  Array.isArray(statement.relation) && statement.relation.includes('delegate_permission/common.handle_all_urls') &&
  statement.target?.namespace === 'android_app' && statement.target.package_name === packageName &&
  Array.isArray(statement.target.sha256_cert_fingerprints) &&
  statement.target.sha256_cert_fingerprints.some(value => typeof value === 'string' && fingerprintPattern.test(value) && value.toUpperCase() === expectedFingerprint));
try {
  const statements = JSON.parse((await read('public/.well-known/assetlinks.json')).toString());
  check('local-digital-asset-links', matchesCertificate(statements), 'The local statement must match the application ID and provider-supplied distribution certificate; an upload certificate is insufficient.');
} catch {
  check('local-digital-asset-links', false, 'Generate public/.well-known/assetlinks.json with npm run android:assetlinks after obtaining the Play app-signing certificate.');
}

for (const [path, required] of [
  ['public/icons/icon-512.png', [512, 512]],
  ['public/icons/icon-192.png', [192, 192]],
  ['public/icons/maskable-512.png', [512, 512]],
  ['docs/release/assets/feature-graphic.png', [1024, 500]],
  ['docs/release/assets/phone-1.jpg', null],
  ['docs/release/assets/phone-2.jpg', null],
  ['docs/release/assets/phone-3.jpg', null],
  ['docs/release/assets/phone-4.jpg', null],
]) {
  try {
    const [width, height] = imageSize(await read(path));
    const valid = required ? width === required[0] && height === required[1] : Math.min(width, height) >= 320 && Math.max(width, height) <= 3840 && Math.max(width, height) <= 2 * Math.min(width, height);
    check(`asset:${path}`, valid, `${width} × ${height}; image freshness and visual accuracy require review against the current app.`);
  } catch {
    check(`asset:${path}`, false, 'Missing or unreadable PNG/JPEG asset.');
  }
}

try {
  const capture = JSON.parse((await read('docs/release/assets/capture-manifest.json')).toString());
  const sourcePaths = [...await appSourcePaths('src'), 'index.html', 'vite.config.js', 'package-lock.json'].sort();
  const sourceDigest = createHash('sha256');
  for (const path of sourcePaths) sourceDigest.update(`${path}\0${createHash('sha256').update(await read(path)).digest('hex')}\n`);
  const currentSource = sourceDigest.digest('hex');
  const images = capture.images;
  let matched = capture.source?.appSourceSha256 === currentSource && Array.isArray(images) && images.length === 4 && new Set(images.map(image => image.path)).size === 4;
  if (matched) {
    for (const image of images) {
      if (!/^phone-[1-4]\.jpg$/.test(image.path) || createHash('sha256').update(await read(`docs/release/assets/${image.path}`)).digest('hex') !== image.sha256) matched = false;
    }
  }
  check('screenshot-source-provenance', matched, 'Four phone screenshots must match their recorded hashes and the current production app-source digest; visual and native-device review remain separate.');
} catch {
  check('screenshot-source-provenance', false, 'Capture current phone UI and update docs/release/assets/capture-manifest.json with portable source and image hashes.');
}

const listing = (await read('docs/release/store-listing.md')).toString();
for (const [heading, limit] of [['App name', 30], ['Short description', 80], ['Full description', 4000]]) {
  const value = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(listing)?.[1]?.trim() || '';
  const length = Array.from(value).length;
  check(`listing:${heading}`, length > 0 && length <= limit, `${length}/${limit} characters.`);
}
check('cached-web-shell', (await stat(join(root, 'dist/sw.js')).catch(() => null))?.isFile() === true, 'Run npm run build to prepare the cached web application shell.');

if (args.includes('--check-site')) {
  if (!site || !fingerprintPattern.test(expectedFingerprint || '')) {
    check('deployed-digital-asset-links', false, 'A configured HTTPS origin and genuine provider certificate are required before the remote check.');
  } else {
    try {
      const url = new URL('/.well-known/assetlinks.json', site);
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const jsonResponse = response.status === 200 && /application\/json/i.test(response.headers.get('content-type') || '');
      check('deployed-digital-asset-links', jsonResponse && matchesCertificate(await response.json()), 'The HTTPS origin must return matching JSON with HTTP 200 and no redirect.');
    } catch {
      check('deployed-digital-asset-links', false, 'The deployed origin did not return a readable matching statement.');
    }
  }
}

const source = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || null;
const sourceDirty = Boolean(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout?.trim());
const ready = checks.every(result => result.passed);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), source, sourceDirty, packageName, versionCode, versionName, targetSdk, site, bundle, status: ready ? 'preflight-passed' : 'blocked', checks, limits: 'This preflight does not confirm Play upload-key identity, device behavior, declarations, production access, review approval, or publication.' }, null, 2));
process.exitCode = ready ? 0 : 1;
