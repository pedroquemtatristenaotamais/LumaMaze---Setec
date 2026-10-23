import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('all module imports resolve to local files', async () => {
  const files = (await readdir(root)).filter(name => name.endsWith('.js'));
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'), `${file} must not require an external runtime dependency`);
      await assert.doesNotReject(access(new URL(match[1], new URL(file, root))), `${file}: ${match[1]}`);
    }
  }
});

test('HTML and renderer images exist in this distribution', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:png|css|js))"/g)) {
    await assert.doesNotReject(access(new URL(match[1], root)), match[1]);
  }
  const renderer = await readFile(new URL('renderer.js', root), 'utf8');
  for (const match of renderer.matchAll(/new URL\(['"]([^'"]+\.png)['"],\s*import.meta.url\)/g)) {
    await assert.doesNotReject(access(new URL(match[1], new URL('renderer.js', root))), match[1]);
  }
});
