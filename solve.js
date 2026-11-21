// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program).
//
// Written from scratch for this competition: a single left-to-right pass
// driven by String#indexOf, slice and regex scans instead of the reference's
// character-at-a-time loop, mirroring csv-reader's broken-row policy exactly:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field opening with a quote runs to the next quote that is not doubled,
//     "" inside it is one quote, each CRLF or lone CR inside it reads as LF;
//     what follows its closing quote, up to the next comma or line break, is
//     appended as it stands (quote_junk, when the field ends); a quote that
//     never closes is a literal character and the text after it is read again
//     as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay
//     strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds
//     the records after it, each padded (short_row, with fields: its count) or
//     cut (long_row, with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met, a record's short_row
//     or long_row when it ends: line the 1-based line its record starts on,
//     counting every LF, CRLF and lone CR inside quotes, and row its record's
//     index in rows, null for the header.

const BREAK = /[\r\n]/g;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Errors read these at the time they are met.
  let recordLine = 1;
  let recordRow = null;

  // A field read's result, written by readUnquoted/readQuoted (run is never
  // re-entered, so no allocation per field): the value, how it ended
  // (0 = comma, 1 = line break, 2 = end of text) and how many characters
  // were kept after the value the read started with.
  let fValue = '';
  let fEnded = 0;
  let fAdded = 0;

  function err(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads an unquoted field starting at pos, with `init` already in the
  // value, into fValue/fEnded/fAdded. The next delimiter is found with
  // indexOf (no match object is allocated); a CR inside the span is a
  // stray_cr unless it is the CR of the CRLF ending the field.
  function readUnquoted(init) {
    let head = init;
    let start = pos;
    for (;;) {
      const ci = text.indexOf(',', pos);
      const ni = text.indexOf('\n', pos);
      let end = n;
      let kind = 2;
      if (ci !== -1 && (ni === -1 || ci < ni)) {
        end = ci;
        kind = 0;
      } else if (ni !== -1) {
        end = ni;
        kind = 1;
      }
      const ri = text.indexOf('\r', pos);
      if (ri === -1 || ri >= end) {
        if (kind === 0) {
          pos = end + 1;
          fValue = head === '' ? text.slice(start, end) : head + text.slice(start, end);
          fEnded = 0;
          fAdded = fValue.length - init.length;
          return;
        }
        if (kind === 1) {
          pos = end + 1;
          line += 1;
          fValue = head === '' ? text.slice(start, end) : head + text.slice(start, end);
          fEnded = 1;
          fAdded = fValue.length - init.length;
          return;
        }
        pos = n;
        fValue = head === '' ? text.slice(start) : head + text.slice(start);
        fEnded = 2;
        fAdded = fValue.length - init.length;
        return;
      }
      if (kind === 1 && ri === end - 1) {
        // CRLF: the field ends at the CR as a line break.
        pos = end + 1;
        line += 1;
        fValue = head === '' ? text.slice(start, ri) : head + text.slice(start, ri);
        fEnded = 1;
        fAdded = fValue.length - init.length;
        return;
      }
      // A lone CR: stray_cr, dropped, and the scan continues after it.
      err('stray_cr');
      head = head === '' ? text.slice(start, ri) : head + text.slice(start, ri);
      pos = ri + 1;
      start = pos;
    }
  }

  // Reads a quoted field whose opening quote is at pos, into
  // fValue/fEnded/fAdded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let q = open + 1;
    let close = -1;
    let escaped = false;
    for (;;) {
      q = text.indexOf('"', q);
      if (q < 0) break;
      if (text.charCodeAt(q + 1) === 34) {
        escaped = true;
        q += 2;
        continue;
      }
      close = q;
      break;
    }
    if (close < 0) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      err('unterminated_quote');
      pos = open + 1;
      line = openLine;
      readUnquoted('"');
      return;
    }
    let value;
    if (!escaped) {
      BREAK.lastIndex = open + 1;
      const b = BREAK.exec(text);
      if (b === null || b.index >= close) {
        // No doubled quote and no line break in the slice: the closing
        // quote found above is the first quote in it, so the field is the
        // slice as it stands.
        value = text.slice(open + 1, close);
        pos = close + 1;
        if (pos >= n) {
          fValue = value;
          fEnded = 2;
          fAdded = 0;
          return;
        }
        const c = text.charCodeAt(pos);
        if (c === 44) {
          pos += 1;
          fValue = value;
          fEnded = 0;
          fAdded = 0;
          return;
        }
        if (c === 10) {
          pos += 1;
          line += 1;
          fValue = value;
          fEnded = 1;
          fAdded = 0;
          return;
        }
        if (c === 13 && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line += 1;
          fValue = value;
          fEnded = 1;
          fAdded = 0;
          return;
        }
        // What follows the closing quote is appended as it stands, up to
        // the next comma or line break.
        readUnquoted(value);
        if (fAdded > 0) err('quote_junk');
        return;
      }
    }
    const seg = text.slice(open + 1, close);
    let breaks = 0;
    for (let i = 0; i < seg.length; i++) {
      const c = seg.charCodeAt(i);
      if (c === 10) {
        breaks += 1;
      } else if (c === 13) {
        breaks += 1;
        if (seg.charCodeAt(i + 1) === 10) i += 1;
      }
    }
    line += breaks;
    value = escaped
      ? seg.replace(/""/g, '"').replace(/\r\n?/g, '\n')
      : seg.replace(/\r\n?/g, '\n');
    pos = close + 1;
    if (pos >= n) {
      fValue = value;
      fEnded = 2;
      fAdded = 0;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = 0;
      fAdded = 0;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = 1;
      fAdded = 0;
      return;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = 1;
      fAdded = 0;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) err('quote_junk');
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    // Fast path: a physical line with no quote is exactly one record (no
    // quoted newline can span lines), so its fields are one split.
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd < 0 ? n : lineEnd;
    let content = text.slice(pos, end);
    if (content.indexOf('"') < 0) {
      if (lineEnd >= 0 && content.charCodeAt(content.length - 1) === 13) {
        content = content.slice(0, -1); // CRLF line ending
      }
      recordLine = line;
      recordRow = header && columns === null ? null : rows.length;
      const cr = content.indexOf('\r');
      if (cr >= 0) {
        // Lone CRs: one stray_cr each, dropped; the line is otherwise read
        // as it stands. A line left empty by this is no record.
        let count = 0;
        for (let i = cr; i < content.length; i++) if (content.charCodeAt(i) === 13) count += 1;
        for (let i = 0; i < count; i++) err('stray_cr');
        content = content.replace(/\r/g, '');
      }
      const fields = content.split(',');
      if (lineEnd >= 0) {
        pos = lineEnd + 1;
        line += 1;
      } else {
        pos = n;
      }
      if (!(fields.length === 1 && fields[0] === '')) {
        if (width < 0) width = fields.length;
        if (header && columns === null) {
          columns = fields;
        } else {
          if (fields.length < width) {
            errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
            while (fields.length < width) fields.push('');
          } else if (fields.length > width) {
            errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
          }
          rows.push(fields);
        }
      }
      continue;
    }

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === 0);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
