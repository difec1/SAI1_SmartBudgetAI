/**
 * API Route: /api/transactions/bulk
 * Accepts CSV uploads and creates transactions with AI classification
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataExtractionAgent, impulseClassificationAgent } from '@/lib/agents';
import { createTransaction } from '@/lib/supabase';
import type { DataExtractionInput, Transaction } from '@/lib/types';

type CsvRow = Partial<DataExtractionInput>;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Keine Datei erhalten.' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSV ist leer.' }, { status: 400 });
    }

    const userId = 'demoUser';
    let succeeded = 0;
    const errors: { line: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.merchant || row.amount === undefined) {
        errors.push({ line: row.__line || i + 1, message: 'merchant und amount sind Pflichtfelder.' });
        continue;
      }

      try {
        const extracted = await dataExtractionAgent(
          {
            date: row.date,
            merchant: row.merchant,
            amount: row.amount,
            rawCategory: row.rawCategory,
            justification: row.justification,
          },
          userId
        );

        const classification = await impulseClassificationAgent({ transaction: extracted });

        const finalTransaction: Transaction = {
          ...extracted,
          category: classification.category,
          isImpulse: classification.isImpulse,
          decisionLabel: classification.decisionLabel,
          decisionExplanation: classification.decisionExplanation,
        };

        await createTransaction(finalTransaction);
        succeeded += 1;
      } catch (error: any) {
        console.error('Bulk row error:', error);
        errors.push({ line: row.__line || i + 1, message: error?.message || 'Unbekannter Fehler.' });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      processed: rows.length,
      succeeded,
      failed: errors.length,
      errors,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler beim Verarbeiten der Datei.' },
      { status: 500 }
    );
  }
}

/**
 * CSV Parser (comma-separated, optional header)
 * Behandelt auch Zeilenumbrüche innerhalb von Anführungszeichen.
 * Expected columns: date, merchant, amount, rawCategory?, justification?
 */
function parseCsv(text: string): (CsvRow & { __line: number })[] {
  const delimiter = ',';
  const rowsRaw: { fields: string[]; line: number }[] = [];

  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let lineNumber = 1;
  let rowStartLine = 1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      // Escape doppeltes Anführungszeichen
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++; // skip next
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      // Zeilenende
      if (char === '\r' && nextChar === '\n') {
        i++; // skip LF in CRLF
      }
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) {
        rowsRaw.push({ fields: row, line: rowStartLine });
      }
      field = '';
      row = [];
      lineNumber += 1;
      rowStartLine = lineNumber;
      continue;
    }

    field += char;
    if (char === '\n') {
      lineNumber += 1;
    }
  }

  // Reste hinzufügen
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) {
      rowsRaw.push({ fields: row, line: rowStartLine });
    }
  }

  if (rowsRaw.length === 0) return [];

  const headerParts = rowsRaw[0].fields.map((h) => h.trim());
  const hasHeader = headerParts.some((h) =>
    ['merchant', 'amount', 'date', 'rawcategory', 'justification'].includes(h.toLowerCase())
  );
  const headers = hasHeader
    ? headerParts
    : ['date', 'merchant', 'amount', 'rawCategory', 'justification'];

  const dataRows = hasHeader ? rowsRaw.slice(1) : rowsRaw;
  const rows: (CsvRow & { __line: number })[] = [];

  dataRows.forEach(({ fields, line }) => {
    const rowObj: CsvRow & { __line: number } = { __line: line };
    headers.forEach((header, idx) => {
      const key = header.trim();
      const value = fields[idx] ? fields[idx].trim() : '';
      if (key.toLowerCase() === 'merchant') rowObj.merchant = value;
      if (key.toLowerCase() === 'amount') rowObj.amount = value ? Number(value.replace(',', '.')) : undefined;
      if (key.toLowerCase() === 'date') rowObj.date = value || undefined;
      if (key.toLowerCase() === 'rawcategory') rowObj.rawCategory = value || undefined;
      if (key.toLowerCase() === 'justification') rowObj.justification = value || undefined;
    });
    rows.push(rowObj);
  });

  return rows;
}
