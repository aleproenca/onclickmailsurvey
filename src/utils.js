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
  if (typeof email !== 'string') return false;

  const value = email.trim();
  const atIndex = value.indexOf('@');
  const lastAtIndex = value.lastIndexOf('@');

  if (atIndex <= 0 || atIndex !== lastAtIndex || atIndex === value.length - 1) {
    return false;
  }

  const localPart = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  const dotIndex = domain.indexOf('.');

  if (!localPart || dotIndex <= 0 || dotIndex === domain.length - 1) {
    return false;
  }

  if (value.includes(' ') || value.includes('\t') || value.includes('\n')) {
    return false;
  }

  return true;
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
