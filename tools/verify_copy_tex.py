"""Shared browser check: copying rendered KaTeX yields its LaTeX source (KaTeX contrib copy-tex)."""
import re

INLINE_TEX = re.compile(r'(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)')
DISPLAY_TEX = re.compile(r'\$\$([\s\S]+?)\$\$')

# Selects the given DOM range, triggers the browser copy command, and records the
# text/plain payload that the real copy event put on the clipboard.
SELECT = """([target, mode]) => {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  const r = document.createRange();
  if (mode === 'inside') {
    const walker = document.createTreeWalker(el.querySelector('.katex-html'), NodeFilter.SHOW_TEXT);
    const first = walker.nextNode(); let last = first; for (let n; (n = walker.nextNode());) last = n;
    r.setStart(first, 0); r.setEnd(last, last.length);
  } else if (mode === 'node') r.selectNode(el);
  else r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  window.__copied = null;
  window.addEventListener('copy', e => { window.__copied = e.clipboardData.getData('text/plain'); }, { once: true });
}"""


async def copy(page, handle, mode):
    await page.evaluate(SELECT, [handle, mode])
    await page.keyboard.press('Control+c')
    event = await page.evaluate('window.__copied')
    clip = await page.evaluate('navigator.clipboard.readText()')
    return event, clip


def norm(text):
    return ' '.join(text.split())


async def check_question(page, ok, qid=202302):
    """Inline, display and mixed text+formula copy inside a text explanation."""
    data = await page.evaluate(f"fetch('data/questions/{qid}.json').then(r => r.json())")
    para = next(
        p.strip() for p in re.split(r'\n\s*\n', data['explanation'])
        if '**' not in p and '![' not in p and INLINE_TEX.search(p) and DISPLAY_TEX.search(p)
    )
    inline_m = INLINE_TEX.search(para)
    display_m = DISPLAY_TEX.search(para)
    first_inline = inline_m.group(0)
    prefix = para[:min(inline_m.start(), display_m.start())].strip()
    body = '.box[data-kind="exp"] .body'
    target_p = await page.evaluate_handle(
        """([body, prefix]) => [...document.querySelectorAll(`${body} p`)].find(p =>
            p.querySelector(':scope > .katex') && p.querySelector('.katex-display') &&
            (!prefix || p.textContent.startsWith(prefix))
        )""",
        [body, prefix],
    )
    inline = await target_p.evaluate_handle("p => p.querySelector(':scope > .katex')")
    display = await target_p.evaluate_handle("p => p.querySelector('.katex-display')")
    event, clip = await copy(page, inline, 'inside')
    ok('复制公式: 行内公式内部选区复制为 $LaTeX$', event == clip == first_inline, (event, clip, first_inline))
    event, clip = await copy(page, display, 'node')
    ok('复制公式: 块级公式复制为 $$LaTeX$$', event == clip and clip.startswith('$$') and clip.endswith('$$') and clip in para, (event, clip))
    event, clip = await copy(page, target_p, 'contents')
    ok('复制公式: 文字与公式混合选区保留文字并还原源码', event == clip and norm(clip) == norm(para), (clip, para))
    plain = await page.evaluate_handle(f"[...document.querySelectorAll('{body} strong')][0]")
    event, clip = await copy(page, plain, 'contents')
    ok('复制公式: 纯文字选区照常复制', clip == await plain.evaluate('e => e.textContent') and '$' not in clip, clip)


async def check_note(page, ok, root='.nb-live'):
    """Notes preview uses a separate sanitized renderer; its formulas copy as source too."""
    inline = await page.evaluate_handle(f"document.querySelector('{root} p .katex')")
    display = await page.evaluate_handle(f"document.querySelector('{root} .math-block .katex-display')")
    _, clip = await copy(page, inline, 'node')
    ok('笔记预览复制: 行内公式为 $LaTeX$', clip == '$s^0$', clip)
    _, clip = await copy(page, display, 'node')
    ok('笔记预览复制: 块级公式为 $$LaTeX$$', clip == '$$\\Phi(s)=\\frac{G(s)}{1+G(s)H(s)}$$', clip)
