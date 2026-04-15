/**
 * app/components/MarkdownRenderer.js
 * Renders Markdown text as formatted HTML using the `marked` library
 * (loaded via CDN in layout.js).
 *
 * Falls back to basic regex-based rendering if marked isn't loaded yet.
 * Applies the .md-content CSS class for styling.
 */
'use client';

import { useMemo } from 'react';

export function sanitizeStreamingMarkdown(md) {
  if (!md) return '';
  if (typeof md !== 'string') md = String(md);

  var out = md;

  if ((out.match(/```/g) || []).length % 2 === 1) {
    out = out.replace(/```([^`]*)$/, '$1');
  }

  if ((out.match(/\*\*/g) || []).length % 2 === 1) {
    var idx = out.lastIndexOf('**');
    if (idx >= 0) out = out.slice(0, idx) + out.slice(idx + 2);
  }

  if ((out.match(/__/g) || []).length % 2 === 1) {
    var idx2 = out.lastIndexOf('__');
    if (idx2 >= 0) out = out.slice(0, idx2) + out.slice(idx2 + 2);
  }

  if ((out.match(/`/g) || []).length % 2 === 1) {
    var idx3 = out.lastIndexOf('`');
    if (idx3 >= 0) out = out.slice(0, idx3) + out.slice(idx3 + 1);
  }

  return out;
}


/**
 * Convert markdown string to HTML.
 * Uses window.marked if available, otherwise a lightweight fallback.
 */
function markdownToHtml(md) {
  if (!md) return '';

  // Ensure input is a string — it might be an object from sessionStorage
  if (typeof md !== 'string') {
    if (typeof md === 'object') {
      // Try common fields: answer, text, summary, content
      md = md.answer || md.text || md.summary || md.content || JSON.stringify(md);
    } else {
      md = String(md);
    }
  }

  if (!md) return '';

  // Use the marked library if loaded
  if (typeof window !== 'undefined' && window.marked) {
    try {
      // Configure marked for safe output
      const html = window.marked.parse(md, {
        breaks: true,
        gfm: true,
      });
      return html;
    } catch (e) {
      console.warn('marked.parse error, using fallback:', e);
    }
  }

  // ── Fallback: basic regex markdown-to-HTML ──────────────────
  let html = md;

  // Escape HTML entities first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code: `...`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings: #### > ### > ## > #
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Unordered lists: - item
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists: 1. item
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Paragraphs: double newline
  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap if already an HTML block element
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|div|table)/.test(block)) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

export default function MarkdownRenderer({ content, className }) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  if (!content) return null;

  return (
    <div
      className={`md-content ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
