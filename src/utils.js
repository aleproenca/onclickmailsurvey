const crypto = require('crypto');

const VALID_ANSWERS = new Set(['sim', 'nao']);

function normalizeAnswer(answer) {
  if (typeof answer !== 'string') return null;
  const normalized = answer.toLowerCase().trim();
  return VALID_ANSWERS.has(normalized) ? normalized : null;
}

function isTokenFormatValid(token) {
  return typeof token === 'string' && /^[a-f0-9]{32,128}$/i.test(token);
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function splitAndNormalizeEmails(rawEmails) {
  if (!rawEmails || typeof rawEmails !== 'string') return [];
  const parts = rawEmails.split(/[\n,;\s]+/g).map((email) => email.trim().toLowerCase());
  const unique = new Set();

  for (const email of parts) {
    if (isEmailValid(email)) {
      unique.add(email);
    }
  }

  return [...unique];
}

function isEmailValid(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDateTime(dateTime) {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('pt-BR', { hour12: false });
}

module.exports = {
  normalizeAnswer,
  isTokenFormatValid,
  generateToken,
  splitAndNormalizeEmails,
  isEmailValid,
  formatDateTime,
};
