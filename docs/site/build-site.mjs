#!/usr/bin/env node
// docs/site/build-site.mjs — the top-level site builder.
//
// Runs three steps:
//   1. build.mjs       — bundles the interpreter to dist/scheme-lang.mjs
//   2. render-ref.mjs  — renders the MD reference to dist/reference.html
//   3. this file       — stitches index.template.html + reference.html
//                        into the final dist/index.html (published root)
//
// The published Pages site is docs/site/dist/. The Pages workflow uploads
// that folder as the site artifact.
//
// Additional artifacts:
//   dist/repl.js        — copied verbatim (import path stays ./dist/... at
//                         serve time when published root is dist/, but we
//                         want the flat structure). We rewrite the import
//                         path so repl.js sits next to scheme-lang.mjs.
//   dist/styles.css     — copied verbatim.
//
// Run:  node docs/site/build-site.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, 'dist')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

// Step 1: bundle the interpreter.
{
  const r = spawnSync(process.execPath, [join(__dirname, 'build.mjs')], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
}

// Step 2: render the reference.
{
  const r = spawnSync(process.execPath, [join(__dirname, 'render-ref.mjs')], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status || 1)
}

// Step 3: copy repl.js + styles.css into dist and rewrite the interpreter
// import path so it's flat next to the module.
{
  const replSrc = readFileSync(join(__dirname, 'repl.js'), 'utf-8')
  const rewritten = replSrc.replace(
    "from './dist/scheme-lang.mjs'",
    "from './scheme-lang.mjs'",
  )
  writeFileSync(join(OUT, 'repl.js'), rewritten, 'utf-8')
  copyFileSync(join(__dirname, 'styles.css'), join(OUT, 'styles.css'))
}

// Step 4: stitch the reference into the template.
{
  const template = readFileSync(join(__dirname, 'index.template.html'), 'utf-8')
  const referenceHtml = readFileSync(join(OUT, 'reference.html'), 'utf-8')
  // Rewrite the CSS + script paths to sit next to index.html.
  let out = template
    .replace(
      '<!-- REFERENCE_INJECTED_HERE -->',
      referenceHtml,
    )
    .replace(/href="\.\/styles\.css"/g, 'href="./styles.css"')
    .replace(/src="\.\/repl\.js"/g, 'src="./repl.js"')
  writeFileSync(join(OUT, 'index.html'), out, 'utf-8')
  process.stdout.write('built ' + join(OUT, 'index.html') + '\n')
  process.stdout.write('  ' + out.length + ' bytes  (' + (out.length / 1024).toFixed(1) + ' KB)\n')
}

// Emit a Jekyll-disabling stub so GitHub Pages serves the folder as-is.
writeFileSync(join(OUT, '.nojekyll'), '')

process.stdout.write('\n  site built at ' + OUT + '\n')
process.stdout.write('  serve locally with:  cd docs/site/dist && python3 -m http.server 8080\n')
