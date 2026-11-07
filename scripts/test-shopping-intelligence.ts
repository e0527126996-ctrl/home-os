import assert from 'node:assert/strict';
import {
  classifyShoppingCategory,
  formatIngredientQuantity,
  mergeQuantityTexts,
  normalizeShoppingName,
  splitIngredientName,
} from '../src/lib/shoppingIntelligence.ts';

const cases: Array<{ name: string; run: () => void }> = [
  {
    name: 'scales ingredient quantities after a separator',
    run: () => assert.equal(formatIngredientQuantity(['שמן זית – 2 כפות'], 2), '4 כף'),
  },
  {
    name: 'parses quantity before ingredient name',
    run: () => {
      assert.equal(splitIngredientName('2 כפות שמן זית'), 'שמן זית');
      assert.equal(formatIngredientQuantity(['2 כפות שמן זית'], 2), '4 כף');
    },
  },
  {
    name: 'parses quantity after ingredient name',
    run: () => {
      assert.equal(splitIngredientName('שמן זית 2 כפות'), 'שמן זית');
      assert.equal(formatIngredientQuantity(['שמן זית 2 כפות'], 2), '4 כף');
    },
  },
  {
    name: 'parses fractional measures',
    run: () => assert.equal(formatIngredientQuantity(['קמח – 1/2 כוס'], 2), '1 כוס'),
  },
  {
    name: 'treats unitless quantities as item counts',
    run: () => assert.equal(formatIngredientQuantity(['ביצים – 6'], 2), '12 יח׳'),
  },
  {
    name: 'merges equal units but keeps incompatible units separate',
    run: () => {
      assert.equal(mergeQuantityTexts('2 כף', '3 כפות'), '5 כף');
      const separate = mergeQuantityTexts('500 גרם', '1 ק״ג');
      assert.match(separate, /500 גרם/);
      assert.match(separate, /1 ק״ג/);
    },
  },
  {
    name: 'normalizes common Hebrew plural aliases',
    run: () => assert.equal(normalizeShoppingName('עגבניות'), normalizeShoppingName('עגבנייה')),
  },
  {
    name: 'classifies common grocery groups',
    run: () => {
      assert.equal(classifyShoppingCategory('עגבניות'), 'ירקות ופירות');
      assert.equal(classifyShoppingCategory('גבינה לבנה'), 'מוצרי חלב וביצים');
      assert.equal(classifyShoppingCategory('חזה עוף'), 'בשר, דגים ועוף');
    },
  },
];

let failed = 0;
for (const testCase of cases) {
  try {
    testCase.run();
    process.stdout.write('✓ ' + testCase.name + '\\n');
  } catch (error) {
    failed += 1;
    process.stderr.write('✗ ' + testCase.name + '\\n');
    process.stderr.write(String(error) + '\\n');
  }
}

process.stdout.write('\\n' + (cases.length - failed) + '/' + cases.length + ' shopping logic tests passed\\n');
if (failed > 0) process.exitCode = 1;
