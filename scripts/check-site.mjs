#!/usr/bin/env node
/*
  Automatic checks for the Sagebrush Studio LLC website.

    node scripts/check-site.mjs

  Plain Node (version 18 or newer) with nothing to install. GitHub runs this on every
  push (see .github/workflows/checks.yml). It exits with a failure if any check fails.

  What it checks:
    1. Links and files: every local link, image, script and stylesheet points at a file
       that exists, and every #anchor points at an element that exists.
    2. Page basics on the main pages: title, description, canonical and share-image tags,
       one h1, the "Skip to content" link, and a Privacy link in the footer.
    3. The old domain, old brand name, old phone number and the removed mail. address do
       not come back anywhere.
    4. sitemap.xml, robots.txt and CNAME agree with each other and with the pages.
    5. Structured data (JSON-LD) is valid, and its phone and email match the Contact page.
    6. HTML is well formed: tags are balanced, ids are unique, every image has alt text.
    7. Privacy promise: no page loads anything from another website.
    8. Stylesheet: braces balance, dark mode and print rules exist, and every colour name
       used with var(--name) is defined.

  Not covered here: how the pages look at phone widths. That needs a real browser.
*/
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://sagebrushstudiollc.com';
// The pages that get the full set of page-basics checks (file name without .html)
const MAIN_PAGES = ['index', 'work', 'process', 'pricing', 'about', 'skills', 'contact', 'free-check', 'privacy'];

const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);
let checksRun = 0;
const section = (name) => { checksRun += 1; console.log(`- ${name}`); };

// ---------- Reading the files ----------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const rel = (full) => full.slice(ROOT.length + 1).split(sep).join('/');
const allFiles = walk(ROOT);
const read = (full) => readFileSync(full, 'utf8');
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
const TEXT_EXT = /\.(html|css|js|mjs|md|json|xml|txt|yml|yaml)$/;
const textFiles = allFiles.filter((f) => TEXT_EXT.test(f) || rel(f) === 'CNAME');

// Remove comments, scripts and styles so their text is not mistaken for page markup
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const markupOnly = (html) => stripComments(html).replace(/<script[\s\S]*?<\/script>/gi, '<script></script>').replace(/<style[\s\S]*?<\/style>/gi, '<style></style>');
const idsIn = (html) => [...markupOnly(html).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

// ---------- 1. Links and files ----------
section('Links, images and anchors point at things that exist');
function resolveLocal(fromRel, target) {
  const clean = target.split('#')[0].split('?')[0];
  if (clean === '') return null; // same-page anchor
  let path = clean.startsWith('/') ? posix.normalize(clean.slice(1)) : posix.normalize(posix.join(posix.dirname(fromRel), clean));
  if (path === '.' || path === '') path = 'index.html';
  if (path.endsWith('/')) path += 'index.html';
  const full = join(ROOT, ...path.split('/'));
  if (existsSync(full) && statSync(full).isDirectory()) return posix.join(path, 'index.html');
  return path;
}
for (const file of htmlFiles) {
  const where = rel(file);
  const html = markupOnly(read(file));
  const ownIds = new Set(idsIn(read(file)));
  const refs = [];
  for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]*)"/g)) refs.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) for (const part of m[1].split(',')) refs.push(part.trim().split(/\s+/)[0]);
  for (const ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(ref)) continue;
    const [, hash = ''] = ref.match(/#(.*)$/) || [];
    const path = resolveLocal(where, ref);
    if (path === null) {
      if (hash && !ownIds.has(hash)) fail(where, `anchor #${hash} has no matching element`);
      continue;
    }
    const full = join(ROOT, ...path.split('/'));
    if (!existsSync(full)) { fail(where, `link or file "${ref}" does not exist`); continue; }
    if (hash && path.endsWith('.html') && !new Set(idsIn(read(full))).has(hash)) fail(where, `"${ref}" points at #${hash}, which does not exist on that page`);
  }
}

// ---------- 2. Page basics ----------
section('Main pages have the basics (title, description, canonical, share image, h1, skip link, Privacy link)');
for (const name of [...MAIN_PAGES, '404']) {
  const where = `${name}.html`;
  const full = join(ROOT, where);
  if (!existsSync(full)) { fail(where, 'file is missing'); continue; }
  const raw = read(full);
  const html = stripComments(raw);
  const markup = markupOnly(raw);
  if (!/<html[^>]*\slang="en"/i.test(html)) fail(where, 'missing lang="en" on <html>');
  if (!/<meta name="viewport"/i.test(html)) fail(where, 'missing viewport meta tag');
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
  if (!title || !title.trim()) fail(where, 'missing <title>');
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
  if (!desc || desc.trim().length < 50) fail(where, 'meta description missing or shorter than 50 characters');
  if ((markup.match(/<h1[\s>]/gi) || []).length !== 1) fail(where, 'there must be exactly one <h1>');
  if (!/<main id="main"/.test(markup)) fail(where, '<main> needs id="main" (the Skip to content target)');
  const skip = markup.indexOf('class="skip-link" href="#main"');
  const mainAt = markup.indexOf('<main');
  if (skip === -1 || (mainAt !== -1 && skip > mainAt)) fail(where, 'the "Skip to content" link must appear before <main>');
  if (!/<footer[\s\S]*href="\/?privacy\.html"[\s\S]*<\/footer>/.test(markup)) fail(where, 'footer is missing the Privacy link');
  if (!/<meta name="color-scheme" content="light dark">/.test(html)) fail(where, 'missing color-scheme meta tag');
  if (name === '404') {
    if (!/<meta name="robots" content="noindex">/.test(html)) fail(where, '404 page must be noindex');
    continue;
  }
  const canonical = `${SITE}/${name === 'index' ? '' : `${name}.html`}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) fail(where, `canonical must be ${canonical}`);
  if (!html.includes(`<meta property="og:url" content="${canonical}">`)) fail(where, `og:url must be ${canonical}`);
  const ogImage = (html.match(/<meta property="og:image" content="([^"]*)"/i) || [])[1];
  if (!ogImage || !ogImage.startsWith(`${SITE}/`)) fail(where, 'og:image missing or not on the site domain');
  else if (!existsSync(join(ROOT, ...ogImage.slice(SITE.length + 1).split('/')))) fail(where, `og:image file ${ogImage} does not exist`);
}

// ---------- 3. Things that must not come back ----------
section('The old domain, old brand name, old phone number and old mail. address are gone');
const FORBIDDEN = [
  [/sagebrushsites\.com/i, 'the old domain sagebrushsites.com'],
  [/sagebrush sites/i, 'the old brand name "Sagebrush Sites"'],
  [/\(?817\)?[\s-]*768[\s-]*7455/, 'the old phone number'],
  [/mail\.sagebrushstudiollc/i, 'the removed mail. sending address'],
];
for (const file of textFiles) {
  const where = rel(file);
  if (where === 'CHANGELOG.md' || where === 'scripts/check-site.mjs') continue; // history and this list name them
  const text = read(file);
  for (const [pattern, what] of FORBIDDEN) if (pattern.test(text)) fail(where, `mentions ${what}`);
}

// ---------- 4. Sitemap, robots, CNAME ----------
section('sitemap.xml, robots.txt and CNAME agree with the pages');
{
  const sitemap = read(join(ROOT, 'sitemap.xml'));
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].trim());
  if (new Set(locs).size !== locs.length) fail('sitemap.xml', 'has duplicate addresses');
  for (const loc of locs) {
    if (!loc.startsWith(`${SITE}/`)) { fail('sitemap.xml', `${loc} is not on ${SITE}`); continue; }
    let path = loc.slice(SITE.length + 1);
    if (path === '' || path.endsWith('/')) path += 'index.html';
    if (!existsSync(join(ROOT, ...path.split('/')))) fail('sitemap.xml', `${loc} has no matching file`);
  }
  for (const name of MAIN_PAGES) {
    const want = `${SITE}/${name === 'index' ? '' : `${name}.html`}`;
    if (!locs.includes(want)) fail('sitemap.xml', `is missing ${want}`);
  }
  if (!read(join(ROOT, 'robots.txt')).includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt', `must contain "Sitemap: ${SITE}/sitemap.xml"`);
  if (read(join(ROOT, 'CNAME')).trim() !== SITE.replace('https://', '')) fail('CNAME', `must be ${SITE.replace('https://', '')}`);
}

// ---------- 5. Structured data ----------
section('Structured data (JSON-LD) is valid and matches the Contact page');
for (const file of htmlFiles) {
  const where = rel(file);
  for (const m of read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (error) { fail(where, `JSON-LD does not parse: ${error.message}`); }
  }
}
{
  const ld = read(join(ROOT, 'index.html')).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const contact = read(join(ROOT, 'contact.html'));
  if (!ld) fail('index.html', 'missing JSON-LD block');
  else {
    const data = JSON.parse(ld[1]);
    const digits = String(data.telephone || '').replace(/\D/g, '');
    if (!digits) fail('index.html', 'JSON-LD has no telephone');
    else if (!contact.includes(`tel:+${digits}`)) fail('contact.html', `phone link does not match the JSON-LD telephone (+${digits})`);
    if (!data.email) fail('index.html', 'JSON-LD has no email');
    else if (!contact.includes(`mailto:${data.email}`)) fail('contact.html', `email link does not match the JSON-LD email (${data.email})`);
  }
}

// ---------- 6. Well-formed HTML ----------
section('HTML is well formed (balanced tags, unique ids, alt text on images)');
const TRACKED = new Set(['div', 'section', 'main', 'header', 'footer', 'nav', 'ul', 'ol', 'form', 'a', 'button', 'article', 'details', 'dl', 'picture', 'span', 'label', 'select']);
for (const file of htmlFiles) {
  const where = rel(file);
  const raw = read(file);
  const markup = markupOnly(raw);
  const stack = [];
  for (const m of markup.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, tag, selfClosing] = m;
    const name = tag.toLowerCase();
    if (!TRACKED.has(name) || selfClosing) continue;
    if (!closing) { stack.push(name); continue; }
    const top = stack.pop();
    if (top !== name) { fail(where, `</${name}> does not match the open <${top || 'nothing'}>`); break; }
  }
  if (stack.length) fail(where, `<${stack[stack.length - 1]}> is never closed`);
  const seen = new Set();
  for (const id of idsIn(raw)) { if (seen.has(id)) fail(where, `id="${id}" is used more than once`); seen.add(id); }
  for (const m of markup.matchAll(/<img\b[^>]*>/gi)) if (!/\salt=/.test(m[0])) fail(where, `image without alt text: ${m[0].slice(0, 70)}`);
}

// ---------- 7. Privacy promise ----------
section('No page loads anything from another website (the Privacy page promises this)');
for (const file of allFiles.filter((f) => f.endsWith('.html') || f.endsWith('.css'))) {
  const where = rel(file);
  const text = stripComments(read(file));
  const external = [];
  for (const m of text.matchAll(/\ssrc="(https?:\/\/[^"]*)"/gi)) external.push(m[1]);
  for (const m of text.matchAll(/<link\b[^>]*\bhref="(https?:\/\/[^"]*)"[^>]*>/gi)) if (/rel="(stylesheet|preload|preconnect|dns-prefetch|modulepreload)"/i.test(m[0])) external.push(m[1]);
  for (const m of text.matchAll(/url\(\s*['"]?(https?:\/\/[^)'"]*)/gi)) external.push(m[1]);
  for (const m of text.matchAll(/@import\s+(?:url\()?['"]?(https?:\/\/[^)'";]*)/gi)) external.push(m[1]);
  for (const url of external) fail(where, `loads from another website: ${url}`);
}

// ---------- 8. Stylesheet ----------
section('flair.css: braces balance, dark mode and print rules exist, every var(--name) is defined');
{
  const css = read(join(ROOT, 'flair.css'));
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const opens = (noComments.match(/\{/g) || []).length;
  const closes = (noComments.match(/\}/g) || []).length;
  if (opens !== closes) fail('flair.css', `unbalanced braces: ${opens} "{" and ${closes} "}"`);
  const dark = noComments.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/);
  if (!dark) fail('flair.css', 'missing the dark mode block');
  else for (const need of ['--cream', '--panel', '--ink', '--ink-soft', '--rust', '--line']) if (!new RegExp(`${need}\\s*:`).test(dark[1])) fail('flair.css', `dark mode does not set ${need}`);
  if (!/@media print/.test(noComments)) fail('flair.css', 'missing print rules');
  // Every colour name used must be defined somewhere (CSS, inline styles, or set by flair.js)
  const defined = new Set();
  for (const file of textFiles.filter((f) => /\.(css|html|js)$/.test(f))) {
    const text = read(file);
    for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
    for (const m of text.matchAll(/['"](--[a-z0-9-]+)['"]/gi)) defined.add(m[1]);
  }
  for (const file of allFiles.filter((f) => f.endsWith('.css') || f.endsWith('.html'))) {
    const text = read(file);
    for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi)) {
      if (m[2] === ',') continue; // has a fallback value
      if (!defined.has(m[1])) fail(rel(file), `uses var(${m[1]}) but ${m[1]} is never defined`);
    }
  }
}

// ---------- Result ----------
if (failures.length) {
  console.error(`\n${failures.length} problem${failures.length === 1 ? '' : 's'} found:\n`);
  for (const line of [...new Set(failures)]) console.error(`  x ${line}`);
  process.exit(1);
}
console.log(`\nAll ${checksRun} checks passed (${htmlFiles.length} HTML pages looked at).`);
