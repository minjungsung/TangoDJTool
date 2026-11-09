import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../docs/dj-roadmap.md', import.meta.url);
const destination = new URL('../docs/dj-roadmap.html', import.meta.url);
const publicDestination = new URL('../public/dj-roadmap.html', import.meta.url);
const markdown = await readFile(source, 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const inline = value => escape(value).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/`([^`]+)`/g, '<code>$1</code>');
const features = [];
let section = '', current = null;
for (const line of markdown.split(/\r?\n/)) {
  if (line.startsWith('## ')) { section = line.slice(3); current = null; }
  const match = line.match(/^- \[([ xX])\] (.+)$/);
  if (match) {
    const completed = match[1].toLowerCase() === 'x';
    current = { completed, text: match[2], details: [], status: completed ? 'complete' : /validation/i.test(section) ? 'validation' : 'backlog' };
    features.push(current);
  } else if (current && /^\s{2,}\S/.test(line)) current.details.push(line.trim());
}
if (!features.length) throw new Error('The DJ roadmap must contain feature checkboxes.');
const counts = Object.fromEntries(['complete', 'validation', 'backlog'].map(status => [status, features.filter(feature => feature.status === status).length]));
const percent = Math.round(counts.complete / features.length * 100);
const updated = markdown.match(/^Updated: \*\*(.+?)\*\*/m)?.[1] || 'See checklist';
const rows = status => features.filter(feature => feature.status === status).map(feature => {
  const title = feature.text.match(/^(~~.+?~~|\*\*.+?\*\*)/)?.[0] || feature.text;
  const description = feature.text.slice(title.length).replace(/^\s*—\s*/, '');
  return `<li><span aria-hidden="true">${feature.completed ? '✓' : '○'}</span><details class="item"><summary>${feature.completed && !title.includes('~~') ? `<s>${inline(title)}</s>` : inline(title)}</summary><div class="acceptance">${inline(description)}${feature.details.length ? `<br>${feature.details.map(inline).join('<br>')}` : ''}</div></details></li>`;
}).join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tango DJ development progress</title>
<style>
:root { color-scheme: light dark; }
html, body { margin: 0; color: var(--foreground, CanvasText); font-family: var(--font-sans, system-ui); }
#dj-roadmap { display: grid; gap: 16px; max-width: 1100px; margin: auto; padding: 24px; }
#dj-roadmap .summary { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; }
#dj-roadmap strong { font-weight: 500; }
#dj-roadmap .note, #dj-roadmap .acceptance { color: var(--muted-foreground, GrayText); }
#dj-roadmap .track { display: flex; height: 14px; overflow: hidden; background: var(--secondary, ButtonFace); }
#dj-roadmap .track span { display: block; }
#dj-roadmap .complete { background: var(--chart-1, Highlight); }
#dj-roadmap .validation { background: var(--chart-2, GrayText); }
#dj-roadmap .legend { display: flex; flex-wrap: wrap; gap: 8px 20px; }
#dj-roadmap .legend span { display: inline-flex; align-items: center; gap: 8px; }
#dj-roadmap .swatch { width: 12px; height: 12px; display: inline-block; }
#dj-roadmap .backlog { background: var(--secondary, ButtonFace); }
#dj-roadmap details { border-bottom: 1px solid var(--border, GrayText); padding-bottom: 12px; }
#dj-roadmap summary { padding: 12px 0; font-weight: 500; }
#dj-roadmap .item { border: none; padding: 0; }
#dj-roadmap .item summary { padding: 0; }
#dj-roadmap ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
#dj-roadmap li { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 8px; overflow-wrap: anywhere; }
#dj-roadmap .acceptance { margin-top: 6px; }
#dj-roadmap a { color: var(--foreground, LinkText); }
@media (pointer: coarse) { #dj-roadmap summary { min-height: 44px; box-sizing: border-box; } }
</style>
</head>
<body>
<main id="dj-roadmap" aria-label="Tango DJ development progress">
<div class="summary"><strong>${counts.complete} / ${features.length} tracked items complete · ${percent}%</strong><span class="note">Updated ${escape(updated)}</span></div>
<div class="track" role="img" aria-label="${counts.complete} complete, ${counts.validation} awaiting validation, ${counts.backlog} planned"><span class="complete" style="width:${counts.complete / features.length * 100}%"></span><span class="validation" style="width:${counts.validation / features.length * 100}%"></span></div>
<div class="legend"><span><i class="swatch complete" aria-hidden="true"></i>Complete ${counts.complete}</span><span><i class="swatch validation" aria-hidden="true"></i>Awaiting validation ${counts.validation}</span><span><i class="swatch backlog" aria-hidden="true"></i>Planned ${counts.backlog}</span></div>
<div class="note">Counts include feature, defect, and validation tasks. They measure this checklist's scope, not effort or readiness for every venue.</div>
<details open><summary>Planned work (${counts.backlog})</summary><ul>${rows('backlog')}</ul></details>
<details open><summary>Awaiting validation (${counts.validation})</summary><ul>${rows('validation')}</ul></details>
<details><summary>✓ Completed (${counts.complete})</summary><ul>${rows('complete')}</ul></details>
<a href="./dj-roadmap.md">Open the source checklist and verification evidence</a>
</main>
</body>
</html>
`;
await writeFile(destination, html);
await writeFile(publicDestination, html.replace('<a href="./dj-roadmap.md">Open the source checklist and verification evidence</a>', '<p class="note">The source checklist and detailed verification evidence are maintained in the project repository.</p>'));
console.log(`DJ roadmap: ${counts.complete}/${features.length} items complete (${percent}%), ${counts.validation} awaiting validation, ${counts.backlog} planned.`);
