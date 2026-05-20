const path = require('path');

module.exports = {
  port: Number(process.env.PORT || 3000),
  baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite'),
  trustProxy: process.env.TRUST_PROXY === 'true',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME || 'Pesquisa OnClick',
    fromEmail: process.env.SMTP_FROM_EMAIL,
  },
};
