function renderEmailTemplate({ campaignTitle, question, urlSim, urlNao }) {
  return `
  <!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;background:#f5f7fb;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;padding:24px;">
              <tr>
                <td>
                  <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Campanha: ${escapeHtml(campaignTitle)}</p>
                  <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${escapeHtml(question)}</h1>
                  <p style="margin:0 0 24px;color:#334155;">Clique em uma opção abaixo:</p>

                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
                    <tr>
                      <td style="padding-right:12px;">
                        <a href="${urlSim}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;">✅ Sim</a>
                      </td>
                      <td>
                        <a href="${urlNao}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:700;">❌ Não</a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:0;font-size:12px;color:#94a3b8;">Se os botões não funcionarem, copie e cole um dos links:</p>
                  <p style="margin:8px 0 0;font-size:12px;color:#475569;word-break:break-all;">Sim: ${urlSim}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#475569;word-break:break-all;">Não: ${urlNao}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = { renderEmailTemplate };
