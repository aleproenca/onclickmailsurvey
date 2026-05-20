require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config');
const {
  normalizeAnswer,
  isTokenFormatValid,
  splitAndNormalizeEmails,
  formatDateTime,
} = require('./utils');
const {
  createCampaign,
  getCampaignById,
  updateCampaignStatus,
  listCampaigns,
  addRecipients,
  listRecipientsByCampaign,
  listRecipientsForCampaign,
  registerResponse,
  updateRecipientSentInfo,
  listResponsesByCampaign,
} = require('./db');
const {
  isSmtpConfigured,
  createTransport,
  sendSurveyEmail,
} = require('./services/emailService');
const { renderEmailTemplate } = require('./email/template');

const app = express();
app.set('trust proxy', config.trustProxy);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.message = req.query.message || null;
  res.locals.messageType = req.query.type || 'success';
  res.locals.formatDateTime = formatDateTime;
  next();
});

app.get('/', (_req, res) => {
  res.redirect('/admin');
});

app.get('/respond', (req, res) => {
  const token = req.query.token;
  const answer = normalizeAnswer(req.query.answer);

  if (!isTokenFormatValid(token) || !answer) {
    return res.status(400).render('response', {
      title: 'Link inválido',
      heading: 'Ops! Esse link não é válido.',
      details: 'Verifique se o link foi copiado completo ou solicite um novo envio.',
      variant: 'warning',
    });
  }

  const result = registerResponse({
    token,
    answer,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  });

  if (result.status === 'invalid') {
    return res.status(404).render('response', {
      title: 'Link não encontrado',
      heading: 'Esse link não foi encontrado ou expirou.',
      details: 'Solicite um novo e-mail para registrar sua resposta.',
      variant: 'warning',
    });
  }

  if (result.status === 'already_answered') {
    return res.status(200).render('response', {
      title: 'Resposta já registrada',
      heading: 'Sua resposta já foi registrada anteriormente.',
      details: `Resposta anterior: ${result.existingResponse.answer.toUpperCase()} em ${formatDateTime(result.existingResponse.answered_at)}.`,
      variant: 'info',
    });
  }

  return res.status(200).render('response', {
    title: 'Obrigado!',
    heading: 'Obrigado pela sua resposta!',
    details: `Sua opção "${answer.toUpperCase()}" foi registrada com sucesso.`,
    variant: 'success',
  });
});

app.get('/admin', (_req, res) => {
  const campaigns = listCampaigns();
  res.render('admin/index', { campaigns });
});

app.get('/admin/campaigns/new', (_req, res) => {
  res.render('admin/new-campaign');
});

app.post('/admin/campaigns', (req, res) => {
  const title = (req.body.title || '').trim();
  const question = (req.body.question || '').trim();

  if (!title || !question) {
    return res.redirect('/admin/campaigns/new?type=error&message=' + encodeURIComponent('Título e pergunta são obrigatórios.'));
  }

  const campaign = createCampaign({
    title,
    question,
    status: 'draft',
  });

  return res.redirect(`/admin/campaigns/${campaign.id}?message=${encodeURIComponent('Campanha criada com sucesso.')}`);
});

app.get('/admin/campaigns/:id', (req, res) => {
  const campaignId = Number(req.params.id);
  if (!Number.isInteger(campaignId)) {
    return res.status(404).render('response', {
      title: 'Campanha não encontrada',
      heading: 'Campanha não encontrada.',
      details: 'Verifique o endereço e tente novamente.',
      variant: 'warning',
    });
  }

  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return res.status(404).render('response', {
      title: 'Campanha não encontrada',
      heading: 'Campanha não encontrada.',
      details: 'Verifique o endereço e tente novamente.',
      variant: 'warning',
    });
  }

  const recipients = listRecipientsByCampaign(campaignId);
  res.render('admin/campaign-details', {
    campaign,
    recipients,
    baseUrl: config.baseUrl,
    smtpConfigured: isSmtpConfigured(),
  });
});

app.post('/admin/campaigns/:id/status', (req, res) => {
  const campaignId = Number(req.params.id);
  const status = req.body.status;
  if (!['draft', 'active', 'closed'].includes(status)) {
    return res.redirect(`/admin/campaigns/${campaignId}?type=error&message=${encodeURIComponent('Status inválido.')}`);
  }

  updateCampaignStatus(campaignId, status);
  return res.redirect(`/admin/campaigns/${campaignId}?message=${encodeURIComponent('Status atualizado com sucesso.')}`);
});

app.post('/admin/campaigns/:id/recipients', (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return res.redirect('/admin?type=error&message=' + encodeURIComponent('Campanha não encontrada.'));
  }

  const emails = splitAndNormalizeEmails(req.body.emails || '');
  if (emails.length === 0) {
    return res.redirect(`/admin/campaigns/${campaignId}?type=error&message=${encodeURIComponent('Nenhum e-mail válido encontrado.')}`);
  }

  const inserted = addRecipients(campaignId, emails);

  return res.redirect(`/admin/campaigns/${campaignId}?message=${encodeURIComponent(`${inserted.length} destinatário(s) adicionado(s).`)}`);
});

app.post('/admin/campaigns/:id/send', async (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return res.redirect('/admin?type=error&message=' + encodeURIComponent('Campanha não encontrada.'));
  }

  if (!isSmtpConfigured()) {
    return res.redirect(`/admin/campaigns/${campaignId}?type=error&message=${encodeURIComponent('SMTP não configurado. Ajuste as variáveis de ambiente.')}`);
  }

  const recipients = listRecipientsForCampaign(campaignId);
  if (recipients.length === 0) {
    return res.redirect(`/admin/campaigns/${campaignId}?type=error&message=${encodeURIComponent('Adicione destinatários antes de enviar.')}`);
  }

  const transporter = createTransport();
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      await sendSurveyEmail({
        campaign,
        recipient,
        baseUrl: config.baseUrl,
        transporter,
      });
      sent += 1;
      updateRecipientSentInfo(recipient.id, new Date().toISOString(), null);
    } catch (error) {
      failed += 1;
      updateRecipientSentInfo(recipient.id, null, String(error.message || 'Falha desconhecida'));
    }
  }

  const message = `Envio concluído: ${sent} enviado(s), ${failed} falha(s).`;
  return res.redirect(`/admin/campaigns/${campaignId}?message=${encodeURIComponent(message)}&type=${failed > 0 ? 'warning' : 'success'}`);
});

app.get('/admin/campaigns/:id/export.csv', (req, res) => {
  const campaignId = Number(req.params.id);
  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return res.status(404).send('Campanha não encontrada.');
  }

  const rows = listResponsesByCampaign(campaignId);
  const header = ['campanha', 'pergunta', 'email', 'resposta', 'data_hora', 'token'];
  const csvRows = [header.join(',')];

  for (const row of rows) {
    const values = [
      row.campaign,
      row.question,
      row.email,
      row.answer,
      row.answered_at,
      row.token,
    ].map(escapeCsvValue);

    csvRows.push(values.join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="campanha-${campaignId}-respostas.csv"`);
  return res.send(csvRows.join('\n'));
});

app.get('/admin/campaigns/:id/email-preview/:recipientId', (req, res) => {
  const campaignId = Number(req.params.id);
  const recipientId = Number(req.params.recipientId);

  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return res.status(404).send('Campanha não encontrada.');
  }

  const recipient = listRecipientsForCampaign(campaignId).find((item) => item.id === recipientId);
  if (!recipient) {
    return res.status(404).send('Destinatário não encontrado.');
  }

  const urlSim = `${config.baseUrl}/respond?token=${encodeURIComponent(recipient.token)}&answer=sim`;
  const urlNao = `${config.baseUrl}/respond?token=${encodeURIComponent(recipient.token)}&answer=nao`;

  const html = renderEmailTemplate({
    campaignTitle: campaign.title,
    question: campaign.question,
    urlSim,
    urlNao,
  });

  return res.send(html);
});

app.use((_req, res) => {
  res.status(404).render('response', {
    title: 'Página não encontrada',
    heading: 'Página não encontrada',
    details: 'Verifique o endereço informado e tente novamente.',
    variant: 'warning',
  });
});

function escapeCsvValue(value) {
  const stringValue = value == null ? '' : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

app.listen(config.port, () => {
  console.log(`OnClick Mail Survey executando em ${config.baseUrl} (porta ${config.port})`);
});
