const nodemailer = require('nodemailer');
const config = require('../config');
const { renderEmailTemplate } = require('../email/template');

function isSmtpConfigured() {
  const { host, fromEmail } = config.smtp;
  return Boolean(host && fromEmail);
}

function createTransport() {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user && config.smtp.pass ? {
      user: config.smtp.user,
      pass: config.smtp.pass,
    } : undefined,
  });
}

async function sendSurveyEmail({ campaign, recipient, baseUrl, transporter }) {
  const urlSim = `${baseUrl}/respond?token=${encodeURIComponent(recipient.token)}&answer=sim`;
  const urlNao = `${baseUrl}/respond?token=${encodeURIComponent(recipient.token)}&answer=nao`;

  const html = renderEmailTemplate({
    campaignTitle: campaign.title,
    question: campaign.question,
    urlSim,
    urlNao,
  });

  return transporter.sendMail({
    from: `${config.smtp.fromName} <${config.smtp.fromEmail}>`,
    to: recipient.email,
    subject: campaign.title,
    html,
    text: `${campaign.question}\n\nSim: ${urlSim}\nNão: ${urlNao}`,
  });
}

module.exports = {
  isSmtpConfigured,
  createTransport,
  sendSurveyEmail,
};
