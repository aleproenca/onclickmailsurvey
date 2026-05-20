const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeAnswer,
  splitAndNormalizeEmails,
  isTokenFormatValid,
} = require('../src/utils');

test('normalizeAnswer aceita somente sim e nao', () => {
  assert.equal(normalizeAnswer('SIM'), 'sim');
  assert.equal(normalizeAnswer('nao'), 'nao');
  assert.equal(normalizeAnswer('talvez'), null);
});

test('splitAndNormalizeEmails filtra e-mails válidos e duplicados', () => {
  const result = splitAndNormalizeEmails('a@teste.com; B@teste.com\ninvalid @x.com a@teste.com');
  assert.deepEqual(result, ['a@teste.com', 'b@teste.com']);
});

test('isTokenFormatValid valida formato do token', () => {
  assert.equal(isTokenFormatValid('abcd1234abcd1234abcd1234abcd1234'), true);
  assert.equal(isTokenFormatValid('bad-token'), false);
});
