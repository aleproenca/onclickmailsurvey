const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');
const { generateToken } = require('./utils');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    sent_at TEXT,
    last_sent_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    UNIQUE(campaign_id, email)
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id INTEGER NOT NULL UNIQUE,
    answer TEXT NOT NULL CHECK (answer IN ('sim', 'nao')),
    answered_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY(recipient_id) REFERENCES recipients(id) ON DELETE CASCADE
  );
`);

const queries = {
  createCampaign: db.prepare(
    `INSERT INTO campaigns (title, question, status) VALUES (@title, @question, @status)`
  ),
  getCampaignById: db.prepare(
    `SELECT id, title, question, status, created_at FROM campaigns WHERE id = ?`
  ),
  updateCampaignStatus: db.prepare(`UPDATE campaigns SET status = ? WHERE id = ?`),
  listCampaigns: db.prepare(`
    SELECT
      c.id,
      c.title,
      c.question,
      c.status,
      c.created_at,
      COUNT(DISTINCT r.id) AS recipients_count,
      COUNT(DISTINCT s.id) AS responses_count,
      SUM(CASE WHEN s.answer = 'sim' THEN 1 ELSE 0 END) AS sim_count,
      SUM(CASE WHEN s.answer = 'nao' THEN 1 ELSE 0 END) AS nao_count
    FROM campaigns c
    LEFT JOIN recipients r ON r.campaign_id = c.id
    LEFT JOIN responses s ON s.recipient_id = r.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `),
  insertRecipient: db.prepare(
    `INSERT OR IGNORE INTO recipients (campaign_id, email, token) VALUES (?, ?, ?)`
  ),
  listRecipientsByCampaign: db.prepare(`
    SELECT
      r.id,
      r.email,
      r.token,
      r.sent_at,
      r.last_sent_error,
      s.answer,
      s.answered_at
    FROM recipients r
    LEFT JOIN responses s ON s.recipient_id = r.id
    WHERE r.campaign_id = ?
    ORDER BY r.created_at DESC
  `),
  getRecipientByToken: db.prepare(`
    SELECT
      r.id,
      r.email,
      r.token,
      c.id AS campaign_id,
      c.title,
      c.question,
      c.status
    FROM recipients r
    JOIN campaigns c ON c.id = r.campaign_id
    WHERE r.token = ?
  `),
  getResponseByRecipientId: db.prepare(
    `SELECT id, recipient_id, answer, answered_at FROM responses WHERE recipient_id = ?`
  ),
  insertResponse: db.prepare(
    `INSERT INTO responses (recipient_id, answer, ip_address, user_agent) VALUES (?, ?, ?, ?)`
  ),
  updateRecipientSentInfo: db.prepare(
    `UPDATE recipients SET sent_at = @sent_at, last_sent_error = @last_sent_error WHERE id = @id`
  ),
  listRecipientsForCampaign: db.prepare(
    `SELECT id, email, token FROM recipients WHERE campaign_id = ? ORDER BY created_at DESC`
  ),
  listResponsesByCampaign: db.prepare(`
    SELECT
      c.title AS campaign,
      c.question,
      r.email,
      s.answer,
      s.answered_at,
      r.token
    FROM responses s
    JOIN recipients r ON r.id = s.recipient_id
    JOIN campaigns c ON c.id = r.campaign_id
    WHERE c.id = ?
    ORDER BY s.answered_at DESC
  `),
};

function createCampaign({ title, question, status = 'draft' }) {
  const result = queries.createCampaign.run({ title, question, status });
  return getCampaignById(result.lastInsertRowid);
}

function getCampaignById(id) {
  return queries.getCampaignById.get(id);
}

function updateCampaignStatus(id, status) {
  queries.updateCampaignStatus.run(status, id);
}

function listCampaigns() {
  return queries.listCampaigns.all();
}

function addRecipients(campaignId, emails) {
  const inserted = [];
  const insertMany = db.transaction((items) => {
    for (const email of items) {
      const token = generateToken();
      const result = queries.insertRecipient.run(campaignId, email, token);
      if (result.changes === 1) {
        inserted.push({ email, token });
      }
    }
  });

  insertMany(emails);
  return inserted;
}

function listRecipientsByCampaign(campaignId) {
  return queries.listRecipientsByCampaign.all(campaignId);
}

function listRecipientsForCampaign(campaignId) {
  return queries.listRecipientsForCampaign.all(campaignId);
}

function registerResponse({ token, answer, ipAddress, userAgent }) {
  const recipient = queries.getRecipientByToken.get(token);
  if (!recipient) {
    return { status: 'invalid' };
  }

  const existingResponse = queries.getResponseByRecipientId.get(recipient.id);
  if (existingResponse) {
    return {
      status: 'already_answered',
      recipient,
      existingResponse,
    };
  }

  queries.insertResponse.run(recipient.id, answer, ipAddress, userAgent);
  return {
    status: 'recorded',
    recipient,
  };
}

function updateRecipientSentInfo(id, sentAt, lastSentError = null) {
  queries.updateRecipientSentInfo.run({
    id,
    sent_at: sentAt,
    last_sent_error: lastSentError,
  });
}

function listResponsesByCampaign(campaignId) {
  return queries.listResponsesByCampaign.all(campaignId);
}

module.exports = {
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
};
