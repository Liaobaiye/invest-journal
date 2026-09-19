import { escapeHtml } from './format.js';

/** Minimal markdown → HTML (no external deps) */
export function renderMarkdown(src) {
  if (!src) return '';
  let text = escapeHtml(String(src));

  // fenced code
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre class="md-pre"><code>${code.replace(/\n$/, '')}</code></pre>`
  );

  // inline code
  text = text.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  // headings
  text = text.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  text = text.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  text = text.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  text = text.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // bold / italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // links / images
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // blockquote
  text = text.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');

  // unordered / ordered lists (simple)
  text = text.replace(/(?:^[-*] (.*)\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map((l) => l.replace(/^[-*] /, ''));
    return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  });

  // paragraphs
  text = text
    .split(/\n{2,}/)
    .map((para) => {
      const t = para.trim();
      if (!t) return '';
      if (/^<(h\d|ul|pre|blockquote)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return text;
}
