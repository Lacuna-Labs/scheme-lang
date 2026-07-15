#!/usr/bin/env python3
"""
rosetta-render-html.py — v0.0 minimal Rosetta HTML renderer.

Usage: rosetta-render-html.py <input.book.slat> > output.html

Reads a typed .book.slat file (single (chapter ...) record with :prose
containing MD) and emits an HTML page per rosetta/default.slat's
'html rule set. This is the first-test proof-of-concept — full renderer
comes in Phase 0 of Book Fix-It Part Two.
"""
import re, sys, os, html

# ── Rosetta type validation ──────────────────────────────────────────────
# Filename must end in .<type>.slat or .<type>.slatl, where <type> is in
# Rosetta's type registry. Otherwise reject at load.

KNOWN_TYPES = {'book', 'cart', 'cortex', 'dewey', 'manifest', 'corpus',
               'mailbox', 'log', 'style', 'training', 'html', 'terminal',
               'search', 'llm-chunk', 'epub', 'pdf-source'}

def validate_filename(path):
    name = os.path.basename(path)
    m = re.match(r'^(.+)\.([a-z-]+)\.slatl?$', name)
    if not m:
        return None, f"filename must end .<type>.slat or .<type>.slatl — got '{name}'"
    stem, typ = m.group(1), m.group(2)
    if typ not in KNOWN_TYPES:
        return None, f"unknown type ':{typ}' — declare in rosetta-types before use"
    return typ, None

# ── Very small SLAT record parser (single-record files) ──────────────────
# Just enough to pull :key values out of a (chapter ...) record with a
# multi-line :prose string. Not a real SLAT parser — Phase 0 will build one.

def parse_slat_chapter(text):
    """Extract :book :chapter-number :title :source-path :size :sha256 :prose."""
    fields = {}
    # Strip ;; comments at top of file
    text = re.sub(r'^;;.*$', '', text, flags=re.MULTILINE).strip()
    # Match simple :key "value" pairs
    for m in re.finditer(r':([\w-]+)\s+"((?:\\.|[^"\\])*)"', text):
        fields[m.group(1)] = _unescape(m.group(2))
    # Match :key <number>
    for m in re.finditer(r':([\w-]+)\s+(\d+|null)(?=\s|\))', text):
        if m.group(1) not in fields:
            fields[m.group(1)] = m.group(2)
    return fields

def _unescape(s):
    return (s.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
             .replace('\\"', '"').replace('\\\\', '\\'))

# ── Very small Markdown → HTML for :prose ────────────────────────────────
# Not a full parser. Handles: headings (# ## ###), paragraphs, fenced code
# blocks (```lang ... ```), bold, italic, inline code, links.

def md_to_html(md):
    out = []
    lines = md.split('\n')
    i = 0
    in_code = False
    code_lang = None
    code_buf = []
    para = []

    def flush_para():
        nonlocal para
        if para:
            joined = ' '.join(l.strip() for l in para if l.strip())
            if joined:
                out.append(f'<p>{_inline(joined)}</p>')
            para = []

    while i < len(lines):
        line = lines[i]
        # fenced code
        cf = re.match(r'^```([\w-]*)\s*$', line)
        if cf and not in_code:
            flush_para()
            in_code = True; code_lang = cf.group(1) or ''; code_buf = []
            i += 1; continue
        if in_code:
            if re.match(r'^```\s*$', line):
                lang_attr = f' data-lang="{code_lang}"' if code_lang else ''
                body_html = html.escape('\n'.join(code_buf))
                classes = 'code'
                if code_lang in ('scheme', 'sakura'):
                    classes += ' scheme runnable'
                    out.append(f'<div class="repl-cell" data-lang="{code_lang}" data-runnable="true">')
                    out.append(f'<pre class="{classes}"{lang_attr}>{body_html}</pre>')
                    out.append(f'<button class="run">Run</button>')
                    out.append(f'<pre class="output" aria-live="polite"></pre>')
                    out.append(f'</div>')
                else:
                    out.append(f'<pre class="{classes}"{lang_attr}>{body_html}</pre>')
                in_code = False; code_lang = None; code_buf = []
                i += 1; continue
            code_buf.append(line); i += 1; continue

        # front-matter YAML block --- ... ---
        if i == 0 and line.strip() == '---':
            # skip until closing ---
            j = i + 1
            while j < len(lines) and lines[j].strip() != '---':
                j += 1
            i = j + 1
            continue

        # headings
        hm = re.match(r'^(#+)\s+(.+)$', line)
        if hm:
            flush_para()
            level = min(len(hm.group(1)), 6)
            out.append(f'<h{level}>{_inline(hm.group(2))}</h{level}>')
            i += 1; continue

        # blockquote
        if line.startswith('> '):
            flush_para()
            bq = []
            while i < len(lines) and lines[i].startswith('> '):
                bq.append(lines[i][2:])
                i += 1
            # sakura-says heuristic: if first line is **Sakura says** treat specially
            joined = '\n'.join(bq)
            klass = 'sakura-says' if re.search(r'\*\*Sakura says\*\*', joined, re.I) else 'quote'
            inner = md_to_html(joined)
            out.append(f'<blockquote class="{klass}">{inner}</blockquote>')
            continue

        # bullet list
        if re.match(r'^\s*[-*]\s+', line):
            flush_para()
            out.append('<ul>')
            while i < len(lines) and re.match(r'^\s*[-*]\s+', lines[i]):
                item = re.sub(r'^\s*[-*]\s+', '', lines[i])
                out.append(f'  <li>{_inline(item)}</li>')
                i += 1
            out.append('</ul>')
            continue

        # blank line = paragraph break
        if not line.strip():
            flush_para(); i += 1; continue

        # accumulate into paragraph
        para.append(line); i += 1

    flush_para()
    return '\n'.join(out)

def _inline(text):
    # `code`
    text = re.sub(r'`([^`]+)`', lambda m: f'<code>{html.escape(m.group(1))}</code>', text)
    # **bold**
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    # *italic*
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', text)
    # [text](url)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)',
                  lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', text)
    return text

# ── HTML page assembly (skeleton — style kit lives elsewhere) ────────────

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="rosetta-version" content="0.0">
<meta name="source-book" content="{book}">
<meta name="source-chapter" content="{chapter}">
<style>
  :root {{ --fg:#222; --bg:#fafafa; --accent:#c46; --code-bg:#f0efeb; --sakura:#fee9f3; }}
  body {{ font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); max-width: 720px; margin: 3rem auto; padding: 0 1.5rem; }}
  h1, h2, h3 {{ font-family: Georgia, serif; line-height: 1.2; }}
  h1 {{ font-size: 2rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; }}
  h2 {{ font-size: 1.5rem; margin-top: 2rem; }}
  h3 {{ font-size: 1.2rem; }}
  pre.code {{ background: var(--code-bg); padding: 0.8rem 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.9rem; }}
  code {{ background: var(--code-bg); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }}
  .repl-cell {{ margin: 1.2rem 0; }}
  .repl-cell button.run {{ background: var(--accent); color: white; border: 0; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; }}
  .repl-cell pre.output {{ background: #222; color: #7f7; padding: 0.6rem 1rem; margin-top: 0.5rem; border-radius: 4px; min-height: 1.5em; font-size: 0.85rem; }}
  .repl-cell pre.output:empty::before {{ content: "· output appears here on Run ·"; color: #555; font-style: italic; }}
  blockquote.sakura-says {{ background: var(--sakura); border-left: 4px solid var(--accent); padding: 0.5rem 1rem; margin: 1rem 0; border-radius: 4px; }}
  blockquote.quote {{ border-left: 3px solid #ccc; padding-left: 1rem; color: #555; font-style: italic; }}
  aside.warning {{ background: #fffbea; border: 1px solid #f0dd88; padding: 0.5rem 1rem; margin: 1rem 0; border-radius: 4px; }}
  aside.aside {{ background: #f0f4ff; padding: 0.5rem 1rem; margin: 1rem 0; border-radius: 4px; font-size: 0.95rem; }}
  header.book-header {{ color: #888; font-size: 0.85rem; margin-bottom: 2rem; text-transform: uppercase; letter-spacing: 0.1em; }}
  footer {{ margin-top: 4rem; padding-top: 1rem; border-top: 1px solid #ddd; color: #999; font-size: 0.8rem; }}
</style>
</head>
<body>
<header class="book-header">{book} · chapter {chapter}</header>
<article class="chapter">
{body}
</article>
<footer>rendered by rosetta v0.0 · source: {source}</footer>
</body>
</html>"""

# ── Main ─────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("usage: rosetta-render-html.py <input.book.slat>", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[1]
    typ, err = validate_filename(path)
    if err:
        print(f"rosetta: {err}", file=sys.stderr)
        sys.exit(1)
    if typ != 'book':
        print(f"rosetta: file type ':{typ}' not supported by html target (yet); v0.0 handles :book only", file=sys.stderr)
        sys.exit(1)
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    fields = parse_slat_chapter(text)
    prose = fields.get('prose', '')
    body_html = md_to_html(prose)
    title = fields.get('title', '(untitled)')
    book = fields.get('book', '(unknown book)')
    chapter = fields.get('chapter-number', 'null')
    print(PAGE.format(
        title=html.escape(title),
        book=html.escape(book),
        chapter=html.escape(str(chapter)),
        body=body_html,
        source=html.escape(path)))

if __name__ == '__main__':
    main()
