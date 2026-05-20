# OnClick Mail Survey (MVP)

Aplicação web para pesquisa por clique em e-mail com foco em baixo custo no Azure.

## Visão geral da arquitetura

- **Backend**: Node.js + Express
- **Views**: EJS server-side render
- **Banco**: SQLite (arquivo local)
- **Envio de e-mail**: SMTP configurável por variáveis de ambiente
- **Hospedagem alvo**: Azure App Service

### Fluxo

1. Admin cria campanha e pergunta.
2. Admin cadastra destinatários; cada destinatário recebe **token único aleatório forte**.
3. Admin envia e-mails com botões `Sim` e `Não`.
4. Clique abre `GET /respond?token=...&answer=sim|nao`.
5. Sistema registra a **primeira resposta** e exibe página amigável.
6. Cliques repetidos no mesmo token mostram mensagem de resposta já registrada.

## Dados registrados por resposta

- e-mail do destinatário (via token interno)
- resposta (`sim` ou `nao`)
- data/hora
- campanha/pergunta
- token único
- IP e user-agent (para auditoria básica)

## Estrutura de banco (SQLite)

Tabelas criadas automaticamente na inicialização:

- `campaigns`: campanha/pergunta/status
- `recipients`: destinatários por campanha + token único
- `responses`: resposta única por destinatário

## Execução local

### Requisitos

- Node.js 20+

### Passos

```bash
npm install
cp .env.example .env
npm start
```

Acesse:

- Painel admin: `http://localhost:3000/admin`

## Scripts

- `npm start`: sobe aplicação
- `npm test`: executa testes unitários básicos

## Variáveis de ambiente

Veja `.env.example`.

Obrigatórias para envio de e-mail real:

- `SMTP_HOST`
- `SMTP_FROM_EMAIL`

Recomendadas:

- `BASE_URL` com URL pública HTTPS
- `TRUST_PROXY=true` no Azure App Service

## Painel administrativo (MVP)

- Criar campanha/pergunta
- Definir status (`draft`, `active`, `closed`)
- Cadastrar destinatários (lista de e-mails)
- Enviar e-mails da campanha por SMTP
- Visualizar respostas e status de envio
- Exportar respostas em CSV
- Pré-visualizar template HTML de e-mail

## Endpoint de resposta

`GET /respond?token=...&answer=sim|nao`

Comportamentos:

- token + resposta válidos e ainda não usados: registra e mostra agradecimento
- token já usado: mantém primeira resposta e informa que já havia sido registrada
- token inválido/ausente: mostra página amigável de erro

## Template de e-mail

- HTML com botões `✅ Sim` e `❌ Não`
- Fallback com links em texto para clientes mais restritivos
- Não expõe e-mail no link, apenas token

## Deploy econômico no Azure App Service

### Estratégia de menor custo (MVP)

1. Criar **App Service Linux** (plano B1 para produção inicial; F1 para testes simples).
2. Publicar via GitHub Actions ou deploy local.
3. Configurar variáveis em **Configuration > Application settings** usando valores do `.env.example`.
4. Definir `BASE_URL=https://<seu-app>.azurewebsites.net`.
5. Garantir HTTPS habilitado (`HTTPS Only`).

> Observação: SQLite em App Service é adequado para MVP/baixo volume. Para escala/alta disponibilidade, migrar para PostgreSQL.

## Segurança e privacidade (MVP)

- Validação de parâmetros (`token`, `answer`, e-mails)
- Tokens aleatórios fortes (`crypto.randomBytes`)
- Primeira resposta prevalece (evita sobrescrita indevida)
- Links não expõem e-mail do destinatário
- Preparado para execução atrás de HTTPS + proxy

## Limitações importantes

- Clique em link de e-mail **não revela automaticamente o e-mail do usuário** no navegador.
- Por isso, a identificação do destinatário depende de **links únicos por token** gerados no momento do cadastro/envio.
- Sem token único por destinatário, não há rastreabilidade confiável da resposta por e-mail.

## Evolução futura recomendada

- Migrar SQLite -> PostgreSQL (Azure Database for PostgreSQL)
- Armazenar segredos no Azure Key Vault
- Adicionar autenticação no painel administrativo
- Implementar observabilidade (Application Insights)
- Adicionar controle de expiração de token e reenvio inteligente
