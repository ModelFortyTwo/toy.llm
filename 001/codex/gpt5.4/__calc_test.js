const fs = require('fs');
const html = fs.readFileSync('calculator.html', 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
if (!match) throw new Error('Script block not found');

function makeEl() {
  return {
    textContent: '',
    innerHTML: '',
    dataset: {},
    className: '',
    classList: { toggle() {}, add() {} },
    appendChild() {},
    addEventListener() {},
    querySelectorAll() { return []; }
  };
}

const documentStub = {
  getElementById() { return makeEl(); },
  querySelector() { return makeEl(); },
  createElement() { return makeEl(); }
};

const windowStub = { addEventListener() {} };
const api = new Function('document', 'window', `${match[1]}; return { evaluateExpression, shouldInsertMultiply, state };`)(documentStub, windowStub);

const approx = (a, b) => Math.abs(a - b) < 1e-9;
const valueTests = [
  ['2+2', 4],
  ['sin(30)', 0.5],
  ['cos(60)', 0.5],
  ['log(1000)', 3],
  ['sqrt(81)+sq(4)', 25],
  ['recip(4)', 0.25],
  ['3!', 6],
  ['pow10(3)', 1000],
  ['neg(5)+2', -3],
  ['sinh(0)', 0]
];

for (const [expr, expected] of valueTests) {
  const actual = api.evaluateExpression(expr);
  if (!approx(actual, expected)) {
    throw new Error(`${expr} => ${actual} (expected ${expected})`);
  }
}

api.state.answer = 5;
if (!approx(api.evaluateExpression('Ans*3'), 15)) {
  throw new Error('Ans handling failed');
}

api.state.expression = '2';
if (!api.shouldInsertMultiply('pi')) throw new Error('Expected implicit multiplication before pi');
api.state.expression = 'pi';
if (!api.shouldInsertMultiply('2')) throw new Error('Expected implicit multiplication after pi');
api.state.expression = ')';
if (!api.shouldInsertMultiply('7')) throw new Error('Expected implicit multiplication after closing parenthesis');

console.log('calculator.html checks passed');
