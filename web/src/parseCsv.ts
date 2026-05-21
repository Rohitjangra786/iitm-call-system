/**
 * Tiny CSV parser. Handles quoted fields, escaped quotes (""), CRLF, and BOM.
 * Avoids pulling in PapaParse to keep the offline bundle small.
 */

export type Row = Record<string, string>

function parseLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  let cur = ''
  let inQuotes = false
  while (i < line.length) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      cur += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { out.push(cur); cur = ''; i++; continue }
    cur += ch; i++
  }
  out.push(cur)
  return out
}

/** Split CSV into logical lines, respecting quoted newlines. */
function splitLines(text: string): string[] {
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '""'; i++; continue }
      inQuotes = !inQuotes
      cur += ch
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      if (cur.trim().length) lines.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim().length) lines.push(cur)
  return lines
}

export function parseCsv(raw: string): Row[] {
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)  // strip BOM
  const lines = splitLines(raw)
  if (lines.length === 0) return []
  const headers = parseLine(lines[0]).map(h => h.trim())
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    const row: Row = {}
    headers.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

/** Pull (name, phone, notes) out of a row with flexible header names. */
export function rowToContact(row: Row): { name: string; phone: string; notes: string } {
  const lower: Row = {}
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = v
  const name =
    lower['name'] ||
    lower['full name'] ||
    lower['student name'] ||
    lower['student'] ||
    ''
  const phone =
    lower['phone'] ||
    lower['telephone'] ||
    lower['telephone no.'] ||
    lower['mobile'] ||
    lower['contact'] ||
    lower['number'] ||
    ''
  const notes =
    lower['notes'] ||
    lower['remarks'] ||
    lower['remark'] ||
    ''
  return { name, phone, notes }
}
