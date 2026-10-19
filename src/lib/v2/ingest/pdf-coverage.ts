export function readPdfOcrPages(
  text: string,
  startPage: number,
  endPage: number,
  truncated = false
): Map<number, string> {
  const pages = new Map<number, string>();
  if (truncated || startPage < 1 || endPage < startPage) return pages;

  const markers = [...text.matchAll(/^[ \t]*---[ \t]*SAYFA[ \t]+(\d+)[ \t]*---[ \t]*$/gim)];
  if (markers.length === 0) {
    if (startPage === endPage && isReadablePage(text)) pages.set(startPage, text.trim());
    return pages;
  }

  const seen = new Set<number>();
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const label = Number(marker[1]);
    // A one-page fallback PDF may be numbered locally by the provider.
    const page = startPage === endPage && label === 1 ? startPage : label;
    if (page < startPage || page > endPage) return new Map();
    if (seen.has(page)) {
      pages.delete(page);
      continue;
    }
    seen.add(page);
    const body = text.slice(marker.index! + marker[0].length, markers[i + 1]?.index).trim();
    if (isReadablePage(body)) pages.set(page, body);
  }
  return pages;
}

export function formatPdfOcrPages(pages: Map<number, string>): string {
  return [...pages.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, text]) => `--- SAYFA ${page} ---\n\n${text}`)
    .join("\n\n");
}

function isReadablePage(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return false;
  if (/\[(?:okunamad[ıiİI]|unreadable)\]/iu.test(text)) return false;
  if (/(?:pdf|belge|dosya).{0,30}(?:okunam[ıiİI]|cannot|unable|unsupported|boş gör[üu]n)/iu.test(text)) return false;
  if (text.length < 300 && /\bsorry\b|unable to (?:read|extract)|cannot (?:read|extract)/i.test(text)) return false;
  if (/\(cid:\d+\)/.test(text)) return false;
  const broken = (compact.match(/[\uFFFD\uE000-\uF8FF]/g) ?? []).length;
  if (broken / compact.length > 0.01) return false;
  const mojibake = (compact.match(/[ÝÞÐýþð]/g) ?? []).length;
  return !(mojibake > 5 && mojibake / compact.length > 0.003);
}
