// Lightweight markdown renderer for static policy/legal content.
// Supports: # h1, ## h2, ### h3, **bold**, paragraphs, - bullet lists, blank line separators.
// Output is sanitized — only escaped HTML primitives are emitted.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  let safe = escapeHtml(text);
  // Bold **text**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return safe;
}

export function renderMarkdown(input: string): string {
  if (!input) return "";
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length > 0) {
      out.push(`<p>${renderInline(paragraphBuf.join(" "))}</p>`);
      paragraphBuf = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      out.push(`<h3>${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      out.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushParagraph();
      closeList();
      out.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else {
      closeList();
      paragraphBuf.push(line);
    }
  }
  flushParagraph();
  closeList();

  return out.join("\n");
}
