/**
 * Legacy CSV importer. Frozen — new work goes in the streaming importer.
 * Kept compiling only because two internal reports still call it.
 */
export interface LegacyRow {
  id: string;
  label: string;
  amount: number;
}

const COLUMNS = ['id', 'label', 'amount'] as const;

function splitLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

export function parseLegacyCsv(text: string): LegacyRow[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const header = splitLine(lines[0]);
  if (header.length !== COLUMNS.length) {
    throw new Error(`expected ${COLUMNS.length} columns, got ${header.length}`);
  }

  const rows: LegacyRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    if (cells.length !== COLUMNS.length) continue;
    const amount = Number(cells[2]);
    rows.push({
      id: cells[0],
      label: cells[1],
      amount: Number.isFinite(amount) ? amount : 0,
    });
  }
  return rows;
}
