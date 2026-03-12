export const EXPECTED_HEADERS = [
  "AniList ID",
  "Title",
  "Status",
  "Current Episode",
  "Total Episodes",
  "Score",
  "Community Score",
  "Format",
  "Franchise",
  "Main Studio",
  "Genres",
  "Airing Status",
  "Season",
  "Recommended By",
  "Started",
  "Completed",
  "Notes",
  "TMDB ID",
  "Linked AniList IDs",
];

// Minimal RFC 4180-compatible CSV parser
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === ',') {
          cells.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

export function validateHeader(header: string[]): string | null {
  if (header.length < EXPECTED_HEADERS.length) {
    return `Invalid CSV format — expected ${EXPECTED_HEADERS.length} columns but found ${header.length}. Make sure this file was exported from this app.`;
  }
  // Check key columns by position
  const keyIndices = [0, 1, 2, 3, 5, 13, 14, 15, 16];
  for (const i of keyIndices) {
    if (header[i]?.trim() !== EXPECTED_HEADERS[i]) {
      return `Invalid CSV format — column ${i + 1} should be "${EXPECTED_HEADERS[i]}" but found "${header[i] ?? ""}". Make sure this file was exported from this app.`;
    }
  }
  return null;
}
