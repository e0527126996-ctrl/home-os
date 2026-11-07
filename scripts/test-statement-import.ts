import assert from 'node:assert/strict';
import {
  normalizeStatementPayee,
  parsePdfLines,
  parseStatementAmount,
  parseStatementFileWithDiagnostics,
} from '../src/lib/statementImport.ts';

const cases: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: 'parses Israeli shekel amounts with thousands and decimal separators',
    run: () => {
      assert.equal(parseStatementAmount('₪ 1,234.56'), 123456);
      assert.equal(parseStatementAmount('1.234,56'), 123456);
      assert.equal(parseStatementAmount('-12.345,67'), -1234567);
      assert.equal(parseStatementAmount('(75.40)'), -7540);
    },
  },
  {
    name: 'parses decimal-comma amounts without corrupting malformed numbers',
    run: () => {
      assert.equal(parseStatementAmount('125,50'), 12550);
      assert.equal(parseStatementAmount('12,34,56'), null);
      assert.equal(parseStatementAmount(''), null);
    },
  },
  {
    name: 'normalizes Hebrew merchant names for duplicate matching',
    run: () => {
      assert.equal(normalizeStatementPayee('שופרסל בע״מ'), normalizeStatementPayee('שופרסל בע"מ'));
      assert.equal(normalizeStatementPayee('רמי-לוי'), normalizeStatementPayee('רמי לוי'));
    },
  },
  {
    name: 'extracts transaction amount rather than the trailing running balance',
    run: () => {
      const rows = parsePdfLines([
        'תאריך פרטים חובה זכות יתרה',
        '01/11/2026 שופרסל סניף מרכז 125.50 4,875.00',
        '04/11/2026 סונול דלק 250 4,875',
      ].join('\n'));
      assert.equal(rows.length, 2);
      assert.equal(rows[0].date, '2026-11-01');
      assert.equal(rows[0].amountCents, 12550);
      assert.equal(rows[0].type, 'EXPENSE');
      assert.match(rows[0].payee, /שופרסל/);
      assert.doesNotMatch(rows[0].payee, /4,875/);
      assert.equal(rows[1].amountCents, 25000);
      assert.match(rows[1].payee, /סונול/);
    },
  },
  {
    name: 'classifies CSV credit and debit columns from their explicit column meaning',
    run: async () => {
      const csv = [
        'תאריך,תיאור,חובה,זכות',
        '01/11/2026,העברה נכנסת,,1250.00',
        '02/11/2026,העברה יוצאת,85.00,',
      ].join('\n');
      const file = new File([csv], 'bank-statement.csv', { type: 'text/csv' });
      const result = await parseStatementFileWithDiagnostics(file, []);
      assert.equal(result.rows.length, 2);
      assert.equal(result.rows[0].type, 'INCOME');
      assert.equal(result.rows[0].amountCents, 125000);
      assert.equal(result.rows[1].type, 'EXPENSE');
      assert.equal(result.rows[1].amountCents, 8500);
    },
  },
  {
    name: 'recognizes salary and social-security deposits as income',
    run: () => {
      const rows = parsePdfLines([
        '02/11/2026 משכורת מעסיק 8,500.00 13,375.00',
        '03/11/2026 ביטוח לאומי 950.00',
      ].join('\n'));
      assert.equal(rows.length, 2);
      assert.equal(rows[0].type, 'INCOME');
      assert.equal(rows[0].amountCents, 850000);
      assert.equal(rows[1].type, 'INCOME');
      assert.equal(rows[1].amountCents, 95000);
    },
  },
  {
    name: 'ignores PDF lines without a valid transaction date and amount',
    run: () => {
      const rows = parsePdfLines([
        'תאריך תיאור סכום יתרה',
        'יתרה קודמת 4,875.00',
        '31/02/2026 שורה עם תאריך לא אפשרי 50.00',
      ].join('\n'));
      assert.equal(rows.length, 0);
    },
  },
];

let failed = 0;
for (const testCase of cases) {
  try {
    await testCase.run();
    process.stdout.write('✓ ' + testCase.name + '\n');
  } catch (error) {
    failed += 1;
    process.stderr.write('✗ ' + testCase.name + '\n');
    process.stderr.write(String(error) + '\n');
  }
}
process.stdout.write('\n' + (cases.length - failed) + '/' + cases.length + ' statement parser tests passed\n');
if (failed > 0) process.exitCode = 1;
