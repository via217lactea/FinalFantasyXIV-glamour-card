import { parse } from 'csv-parse/sync';

/**
 * The two datamining repos use different CSV dialects:
 *
 *  - "oxidizer"     (xivapi/ffxiv-datamining, csv/en + csv/ja)
 *      line 1 : column names  -> "#,Singular,Plural,..."
 *      line 2+: data
 *
 *  - "saintcoinach" (Ra-Workspace/ffxiv-datamining-ko, csv/)
 *      line 1 : ordinal index -> "key,0,1,2,..."
 *      line 2 : column names  -> "#,Singular,Adjective,..."
 *      line 3 : column types  -> "int32,str,str,..."
 *      line 4+: data
 *
 * Column ORDER differs between the two, so everything must be addressed by
 * name, never by position.
 */
export type Dialect = 'oxidizer' | 'saintcoinach';

export interface Sheet {
  /** Row key (the "#" column) -> row accessor */
  rows: Map<number, Row>;
  has(column: string): boolean;
  size: number;
}

export interface Row {
  key: number;
  str(column: string): string;
  int(column: string): number;
  bool(column: string): boolean;
}

function detectDialect(text: string): Dialect {
  return text.slice(0, 5).replace(/^\uFEFF/, '').startsWith('key,')
    ? 'saintcoinach'
    : 'oxidizer';
}

export function readSheet(text: string): Sheet {
  const dialect = detectDialect(text);
  const table: string[][] = parse(text, {
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  });

  const headerRow = dialect === 'saintcoinach' ? 1 : 0;
  const firstDataRow = dialect === 'saintcoinach' ? 3 : 1;
  /** SaintCoinach ships a type row; oxidizer does not. */
  const types = dialect === 'saintcoinach' ? table[2].map((t) => t.trim()) : [];

  // Duplicate/blank column names exist in the raw sheets (padding columns).
  // First occurrence wins, blanks are skipped.
  const index = new Map<string, number>();
  table[headerRow].forEach((name, i) => {
    const clean = name.trim();
    if (clean && clean !== '#' && !index.has(clean)) index.set(clean, i);
  });

  /**
   * Some SaintCoinach sheets ship a name row that has drifted out of alignment
   * with the data — the Korean Stain sheet labels column 4 "Name" while the
   * actual string lives at column 6. The type row is authoritative, so when a
   * text column resolves to a non-text type we walk forward to the first `str`.
   */
  const strIndex = new Map<string, number>();
  const resolveStr = (column: string): number | undefined => {
    if (strIndex.has(column)) return strIndex.get(column);
    let i = index.get(column);
    if (i !== undefined && types.length && types[i] !== 'str') {
      const corrected = types.findIndex((t, j) => j >= i! && t === 'str');
      if (corrected >= 0) {
        console.warn(
          `  ~ column "${column}" declared as ${types[i]} at ${i}; realigned to str at ${corrected}`,
        );
        i = corrected;
      }
    }
    strIndex.set(column, i as number);
    return i;
  };

  const rows = new Map<number, Row>();
  for (let r = firstDataRow; r < table.length; r++) {
    const cells = table[r];
    const key = Number(cells[0]);
    if (!Number.isFinite(key)) continue;

    const at = (column: string, i = index.get(column)): string =>
      i === undefined ? '' : (cells[i] ?? '');

    rows.set(key, {
      key,
      str: (c) => at(c, resolveStr(c)).trim(),
      int: (c) => {
        const n = Number(at(c));
        return Number.isFinite(n) ? n : 0;
      },
      bool: (c) => at(c).trim().toLowerCase() === 'true',
    });
  }

  return {
    rows,
    size: rows.size,
    has: (column) => index.has(column),
  };
}
