import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

const PAGE_BASE_STYLE = `
  body { font-family: Arial, sans-serif; margin: 16px; }
  textarea { width: 100%; min-height: 120px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; }
  input, select { padding: 6px; margin: 4px 0; width: 100%; max-width: 520px; }
  .row { margin: 12px 0; }
  .container { max-width: 920px; }
  .menu a { display: inline-block; margin-right: 12px; margin-bottom: 8px; }
  .result { background: #0b1020; color: #e7eefc; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; }
  .hint { color: #556; font-size: 13px; margin-top: 6px; max-width: 720px; }
  button { padding: 10px 14px; margin-top: 10px; cursor: pointer; }
`;

function htmlShell(params: {
  title: string;
  apiBase: string;
  content: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${params.title}</title>
    <style>${PAGE_BASE_STYLE}</style>
  </head>
  <body>
    <div class="container">
      <h2>${params.title}</h2>
      <div class="menu">
        <a href="${params.apiBase}/merchant-ui">Index</a>
        <a href="${params.apiBase}/merchant-ui/deposit">Deposit</a>
        <a href="${params.apiBase}/merchant-ui/withdrawal">Withdrawal</a>
        <a href="${params.apiBase}/merchant-ui/bank-list">Bank List</a>
        <a href="${params.apiBase}/merchant-ui/balance-inquiry">Balance Inquiry</a>
        <a href="${params.apiBase}/merchant-ui/payout-inquiry">Payout Inquiry</a>
        <a href="${params.apiBase}/merchant-ui/profile">Profile</a>
      </div>
      ${params.content}
    </div>
  </body>
</html>`;
}

function renderFormPage(params: {
  title: string;
  apiBase: string;
  formId: string;
  submitButtonText: string;
  fieldsHtml: string;
  targetPath: string; // relative to apiBase
  buildBodyJs?: string;
}) {
  const buildBodyJs = params.buildBodyJs ?? '';
  const apiUrl = `${params.apiBase}${params.targetPath}`;

  return htmlShell({
    title: params.title,
    apiBase: params.apiBase,
    content: `
      <p class="hint">All requests use <b>X-API-Key</b> header. Paste your merchant secret key below.</p>
      <div class="row">
        <form id="${params.formId}" onsubmit="return false;">
          ${params.fieldsHtml}
          <button type="button" onclick="submit${params.formId.replace(/[^a-zA-Z0-9]/g, '')}()">${params.submitButtonText}</button>
        </form>
      </div>
      <div class="row">
        <div class="result" id="${params.formId}-result">Response will appear here.</div>
      </div>
      <script>
        async function submit${params.formId.replace(/[^a-zA-Z0-9]/g, '')}() {
          const form = document.getElementById('${params.formId}');
          const resultEl = document.getElementById('${params.formId}-result');
          const fd = new FormData(form);
          const apiKey = fd.get('apiKey');
          resultEl.textContent = 'Sending...';

          ${buildBodyJs}
          const body = buildFormBody(fd);

          const resp = await fetch('${apiUrl}', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'X-API-Key': apiKey,
            },
            body,
          });

          const text = await resp.text();
          try {
            resultEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            resultEl.textContent = text;
          }
        }

        function buildFormBody(fd) {
          const params = new URLSearchParams();
          for (const [k, v] of fd.entries()) {
            if (k === 'apiKey') continue;
            if (v === null || v === undefined) continue;
            const s = String(v);
            if (s.trim() === '') continue; // avoid sending empty optional fields
            params.append(k, s);
          }
          return params.toString();
        }
      </script>
    `,
  });
}

@Controller('merchant-ui')
export class MerchantUiController {
  private readonly apiPrefix: string;

  constructor(configService: ConfigService) {
    // In main.ts, global prefix is configured as API_PREFIX (default: api/v1).
    // This controller is itself under `merchant-ui`, so full path becomes:
    //   /<apiPrefix>/merchant-ui/...
    this.apiPrefix = '/' + String(configService.get<string>('API_PREFIX') || 'api/v1').replace(/^\//, '').replace(/\/+$/, '');
  }

  private apiBase() {
    return this.apiPrefix;
  }

  @Get()
  getIndex(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      htmlShell({
        title: 'GoldPay Merchant Test UI',
        apiBase,
        content: `
          <p class="hint">
            Use these pages to test the merchant API directly from the browser using your <b>merchant X-API-Key</b>.
          </p>
          <p class="hint">
            Recommended: use the Swagger merchant UI too:
            <a href="${apiBase}/docs/merchant" target="_blank" rel="noreferrer">${apiBase}/docs/merchant</a>
          </p>
        `,
      }),
    );
  }

  @Get('profile')
  getProfile(@Res() res: Response) {
    const apiBase = this.apiBase();
    return res
      .type('text/html')
      .send(
        htmlShell({
          title: 'Merchant Profile',
          apiBase,
          content: `
            <div class="row">
              <label>Merchant X-API-Key</label>
              <input name="apiKey" form="profile-form" placeholder="paste your secret key" />
            </div>
            <div class="row">
              <button type="button" onclick="loadProfile()">Load</button>
            </div>
            <div class="row">
              <div class="result" id="profile-result">Response will appear here.</div>
            </div>
            <script>
              async function loadProfile() {
                const resultEl = document.getElementById('profile-result');
                const apiKeyInput = document.querySelector('input[name="apiKey"]');
                const apiKey = apiKeyInput.value;
                resultEl.textContent = 'Sending...';

                const resp = await fetch('${apiBase}/merchants/me', {
                  method: 'GET',
                  headers: { 'X-API-Key': apiKey },
                });

                const text = await resp.text();
                try { resultEl.textContent = JSON.stringify(JSON.parse(text), null, 2); }
                catch { resultEl.textContent = text; }
              }
            </script>
          `,
        }),
      );
  }

  @Get('deposit')
  deposit(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      renderFormPage({
        title: 'Deposit (deposit endpoint)',
        apiBase,
        formId: 'deposit-form',
        submitButtonText: 'Create Deposit',
        targetPath: '/funding/deposits',
        fieldsHtml: `
          <div class="row">
            <label>Merchant X-API-Key</label>
            <input name="apiKey" placeholder="paste your secret key" />
          </div>
          <div class="row">
            <label>amount</label>
            <input name="amount" type="number" step="0.01" value="50000" />
          </div>
          <div class="row">
            <label>currency (optional)</label>
            <input name="currency" value="USD" />
          </div>
          <div class="row">
            <label>reference_id (optional)</label>
            <input name="reference_id" value="" />
          </div>
          <div class="row">
            <label>idempotency_key (optional)</label>
            <input name="idempotency_key" value="" />
          </div>
          <div class="row">
            <label>metadata (JSON string)</label>
            <textarea name="metadata">{
  "pay_type": 7,
  "merchant_order": "SH0001",
  "pay_date": "2022-05-20 11:18:00",
  "userinfo": "MA THI VAN",
  "user_ip": "127.0.0.1",
  "bank_code": 1,
  "extend": ""
}</textarea>
            <div class="hint">This metadata must include DPay channel fields (e.g. pay_type, pay_date, userinfo, user_ip, merchant_order...).</div>
          </div>
          <div class="row">
            <label>sandbox (JSON string, optional)</label>
            <textarea name="sandbox"></textarea>
          </div>
        `,
      }),
    );
  }

  @Get('withdrawal')
  withdrawal(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      renderFormPage({
        title: 'Withdrawal (withdrawal endpoint)',
        apiBase,
        formId: 'withdrawal-form',
        submitButtonText: 'Create Withdrawal',
        targetPath: '/funding/withdrawals',
        fieldsHtml: `
          <div class="row">
            <label>Merchant X-API-Key</label>
            <input name="apiKey" placeholder="paste your secret key" />
          </div>
          <div class="row">
            <label>amount</label>
            <input name="amount" type="number" step="0.01" value="100000" />
          </div>
          <div class="row">
            <label>currency (optional)</label>
            <input name="currency" value="USD" />
          </div>
          <div class="row">
            <label>reference_id (optional)</label>
            <input name="reference_id" value="" />
          </div>
          <div class="row">
            <label>idempotency_key (optional)</label>
            <input name="idempotency_key" value="" />
          </div>
          <div class="row">
            <label>metadata (JSON string)</label>
            <textarea name="metadata">{
  "merchant_order": "SH0001",
  "order_date": "2022-05-20 11:18:00",
  "userinfo": "1004",
  "user_ip": "127.0.0.1",
  "target_bank": "4122444",
  "bank_name": "970416",
  "target_bank_user": "PHAM MANH HUNG",
  "extend": ""
}</textarea>
            <div class="hint">
              DPay payout fields must be inside metadata for withdrawal: target_bank, bank_name, target_bank_user, order_date, userinfo, user_ip, merchant_order.
            </div>
          </div>
          <div class="row">
            <label>sandbox (JSON string, optional)</label>
            <textarea name="sandbox"></textarea>
          </div>
        `,
      }),
    );
  }

  @Get('bank-list')
  bankList(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      renderFormPage({
        title: 'DPay Bank List (CDC M)',
        apiBase,
        formId: 'banklist-form',
        submitButtonText: 'Query Banks',
        targetPath: '/funding/bank-list',
        fieldsHtml: `
          <div class="row">
            <label>Merchant X-API-Key</label>
            <input name="apiKey" placeholder="paste your secret key" />
          </div>
          <div class="row">
            <label>pay_type</label>
            <input name="pay_type" type="number" value="7" />
            <div class="hint">Example: 7=bankQR, 9=banktransfer, 8=momo.</div>
          </div>
        `,
      }),
    );
  }

  @Get('balance-inquiry')
  balanceInquiry(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      renderFormPage({
        title: 'DPay Balance Inquiry (Look/get_coin)',
        apiBase,
        formId: 'balance-form',
        submitButtonText: 'Query Balance',
        targetPath: '/funding/balance-inquiry',
        fieldsHtml: `
          <div class="row">
            <label>Merchant X-API-Key</label>
            <input name="apiKey" placeholder="paste your secret key" />
          </div>
          <div class="row">
            <label>find_date (optional)</label>
            <input name="find_date" value="" placeholder="2022-05-20 11:18:00" />
          </div>
        `,
      }),
    );
  }

  @Get('payout-inquiry')
  payoutInquiry(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      renderFormPage({
        title: 'DPay Payout Inquiry (Look/pay_order)',
        apiBase,
        formId: 'payout-form',
        submitButtonText: 'Query Payout',
        targetPath: '/funding/payout-inquiry',
        fieldsHtml: `
          <div class="row">
            <label>Merchant X-API-Key</label>
            <input name="apiKey" placeholder="paste your secret key" />
          </div>
          <div class="row">
            <label>transaction_id (optional; withdrawal id)</label>
            <input name="transaction_id" type="number" value="" />
          </div>
          <div class="row">
            <label>merchant_order (optional; required when transaction_id is empty)</label>
            <input name="merchant_order" value="SH0001" />
          </div>
          <div class="row">
            <label>find_date (optional; required when transaction_id is empty)</label>
            <input name="find_date" value="2022-05-20 11:18:00" />
          </div>
        `,
      }),
    );
  }

  @Get('docs')
  docs(@Res() res: Response) {
    const apiBase = this.apiBase();
    res.type('text/html').send(
      htmlShell({
        title: 'Merchant API Docs',
        apiBase,
        content: `
          <p class="hint">
            This is a quick contract page for merchant integrations. For full schemas/validation, use Swagger:
            <a href="${apiBase}/docs/merchant" target="_blank" rel="noreferrer">${apiBase}/docs/merchant</a>.
          </p>

          <h3>Auth</h3>
          <pre>X-API-Key: &lt;merchant secret&gt;</pre>

          <h3>Base paths</h3>
          <pre>${apiBase}</pre>

          <h3>Funding (recommended)</h3>
          <ul>
            <li><b>POST</b> ${apiBase}/funding/deposits</li>
            <li><b>POST</b> ${apiBase}/funding/withdrawals</li>
            <li><b>POST</b> ${apiBase}/funding/bank-list (DPay only, pay_type)</li>
            <li><b>POST</b> ${apiBase}/funding/balance-inquiry (DPay only)</li>
            <li><b>POST</b> ${apiBase}/funding/payout-inquiry (DPay only)</li>
          </ul>

          <h3>Transactions</h3>
          <ul>
            <li><b>GET</b> ${apiBase}/transactions</li>
            <li><b>POST</b> ${apiBase}/transactions (includes <code>type</code>)</li>
            <li><b>GET</b> ${apiBase}/transactions/:id</li>
          </ul>

          <h3>Request bodies</h3>
          <p class="hint">
            <code>metadata</code> and <code>sandbox</code> are sent as objects in JSON requests.
            If you submit HTML forms (application/x-www-form-urlencoded), send <code>metadata</code> and <code>sandbox</code>
            as JSON strings.
          </p>

          <h3>Response mapping (important)</h3>
          <p class="hint">
            On create/get, GoldPay returns a transaction object with provider instructions under <code>payment</code>.
            If the upstream provider fails, you get <code>status: "failed"</code>,
            and <code>provider_error</code> (for DPay: <code>code</code> + <code>message</code>).
          </p>

          <h3>DPay support</h3>
          <p class="hint">
            DPay bank-related issues often return code <code>1022</code> with a message like
            <code>payment system maintaining</code>.
            Use the message text (and code) to understand the exact cause.
          </p>

          <h3>Testing</h3>
          <p class="hint">
            Use the HTML test forms:
            <a href="${apiBase}/merchant-ui/deposit">Deposit</a>,
            <a href="${apiBase}/merchant-ui/withdrawal">Withdrawal</a>,
            <a href="${apiBase}/merchant-ui/bank-list">Bank List</a>,
            <a href="${apiBase}/merchant-ui/balance-inquiry">Balance Inquiry</a>,
            <a href="${apiBase}/merchant-ui/payout-inquiry">Payout Inquiry</a>.
          </p>
        `,
      }),
    );
  }
}

