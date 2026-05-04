import { createCatalogHelpers } from '../server-lib/catalog-helpers.mjs'
import { createAnalyticsHelpers } from '../server-lib/analytics-helpers.mjs'
import { annualBillingMultiplier, channelCatalog, modelCatalog, planCatalog } from '../shared/catalog.mjs'

const bodyLimitBytes = 1024 * 1024
const defaultOrigin = 'https://my-tradingagents.workers.dev'
const defaultSiteTitle = 'TradingAgents AI - Hosted Multi-Agent Research Desks'
const defaultSiteDescription =
  'Launch hosted TradingAgents research desks for staged market analysis, debate, portfolio review, and repeatable investment workflows.'
const guestUserEmail = 'guest@tradingagents.local'
const guestCookieName = 'mca_guest'
const sessionCookieName = 'mca_session'
const guestTtlSeconds = 90 * 24 * 60 * 60
const sessionTtlSeconds = 7 * 24 * 60 * 60
const indexableSitemapPaths = [
  '/',
  '/compare/tradingagents-vs-single-llm',
  '/compare/tradingagents-vs-manual-research',
  '/solutions/equity-research-desk',
  '/solutions/paper-trading-lab',
  '/solutions/risk-review-workflows',
  '/resources/tradingagents-github',
  '/resources/tradingagents-cn',
  '/resources/tradingagents-ai',
  '/resources/tradingagents-reddit',
  '/resources/tradingagents-docker',
  '/resources/tradingagents-review',
  '/resources/tradingagents-paper',
  '/resources/trading-agents-arxiv',
  '/privacy',
  '/terms',
]
const creemProductCache = new Map()

const seoPageMap = new Map([
  [
    '/',
    {
      title: defaultSiteTitle,
      description: defaultSiteDescription,
      robots: 'index,follow',
    },
  ],
  [
    '/compare/tradingagents-vs-single-llm',
    {
      title: 'TradingAgents AI vs a single-LLM trading prompt | TradingAgents',
      description:
        'Compare the TradingAgents desk with a single trading prompt when you need analyst separation, visible disagreement, and a clearer risk review.',
      robots: 'index,follow',
    },
  ],
  [
    '/compare/tradingagents-vs-manual-research',
    {
      title: 'TradingAgents AI vs fully manual trading research | TradingAgents',
      description:
        'Compare the hosted TradingAgents desk with fully manual research when your team needs repeatability, speed, and structured review.',
      robots: 'index,follow',
    },
  ],
  [
    '/solutions/equity-research-desk',
    {
      title: 'Use TradingAgents AI as a multi-agent equity research desk | TradingAgents',
      description:
        'Launch a hosted TradingAgents desk for structured equity research, analyst debate, risk review, and repeatable ticker-by-ticker memos.',
      robots: 'index,follow',
    },
  ],
  [
    '/solutions/paper-trading-lab',
    {
      title: 'Use TradingAgents AI for paper trading and scenario testing | TradingAgents',
      description:
        'Use TradingAgents to test market workflows in paper trading, compare providers, and review decisions before real capital is involved.',
      robots: 'index,follow',
    },
  ],
  [
    '/solutions/risk-review-workflows',
    {
      title: 'Make risk review part of the TradingAgents workflow | TradingAgents',
      description:
        'Use TradingAgents to keep portfolio review and risk challenge visible before a final market action is approved.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-github',
    {
      title: 'TradingAgents GitHub guide for evaluating the source project | TradingAgents',
      description:
        'Review the TradingAgents GitHub repository with an operator lens before you launch, fork, or compare it with another research workflow.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-cn',
    {
      title: 'TradingAgents-CN guide for Chinese-speaking teams | TradingAgents',
      description:
        'Understand how Chinese-speaking teams can approach TradingAgents, including provider choice, bilingual workflows, and setup friction.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-ai',
    {
      title: 'What TradingAgents AI means in practice | TradingAgents',
      description:
        'Understand TradingAgents AI as a hosted multi-agent market research desk rather than a black-box trading bot.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-reddit',
    {
      title: 'How to read TradingAgents Reddit discussions responsibly | TradingAgents',
      description:
        'Use community discussion as a signal source, then verify the claims that matter in the repository and paper.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-docker',
    {
      title: 'TradingAgents Docker guide | TradingAgents',
      description:
        'Review when the Docker path helps, what credentials to prepare, and when a hosted desk is simpler than self-hosting.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-review',
    {
      title: 'TradingAgents review guide | TradingAgents',
      description:
        'Evaluate TradingAgents by workflow quality, setup friction, reviewability, and repeatability rather than hype alone.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/tradingagents-paper',
    {
      title: 'TradingAgents paper guide | TradingAgents',
      description:
        'Read the TradingAgents paper for architecture, role design, and the right way to interpret its experimental claims.',
      robots: 'index,follow',
    },
  ],
  [
    '/resources/trading-agents-arxiv',
    {
      title: 'Trading agents arXiv guide | TradingAgents',
      description:
        'Use the arXiv record to check version history, citation details, and how the research evolved over time.',
      robots: 'index,follow',
    },
  ],
  [
    '/privacy',
    {
      title: 'Privacy Policy | TradingAgents',
      description:
        'Read how TradingAgents processes visitor, account, order, payment, provisioning, and support information.',
      robots: 'index,follow',
    },
  ],
  [
    '/terms',
    {
      title: 'Terms of Service | TradingAgents',
      description:
        'Review the TradingAgents Terms of Service for account, order, payment, provisioning, console, and support usage.',
      robots: 'index,follow',
    },
  ],
  [
    '/plans',
    {
      title: 'Pricing Plans | TradingAgents',
      description:
        'Choose a TradingAgents plan based on workspace volume, then continue into payment and console-based provisioning tracking.',
      robots: 'noindex,nofollow',
    },
  ],
  [
    '/console',
    {
      title: 'Console | TradingAgents',
      description:
        'Track TradingAgents orders, provisioning, upgrades, and account operations inside the console.',
      robots: 'noindex,nofollow',
    },
  ],
  [
    '/checkout',
    {
      title: 'Checkout | TradingAgents',
      description:
        'Continue through payment and provisioning tracking inside the TradingAgents checkout flow.',
      robots: 'noindex,nofollow',
    },
  ],
])

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function formatMoney(amountCents, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100)
}

const { getChannelById, getModelById, resolvePlanSelection, validateCommunicationToken } = createCatalogHelpers({
  annualBillingMultiplier,
  channelCatalog,
  formatMoney,
  HttpError,
  modelCatalog,
  planCatalog,
})

function getEnv(env, key) {
  const value = env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function firstEnv(env, ...keys) {
  for (const key of keys) {
    const value = getEnv(env, key)
    if (value) {
      return value
    }
  }

  return ''
}

async function getSecretValue(value) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value && typeof value.get === 'function') {
    const resolved = await value.get()
    return typeof resolved === 'string' ? resolved.trim() : ''
  }

  return ''
}

async function firstSecretEnv(env, ...keys) {
  for (const key of keys) {
    const value = await getSecretValue(env?.[key])
    if (value) {
      return value
    }
  }

  return ''
}

function getSecurityHeaders() {
  return new Headers({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  })
}

function getConfiguredOrigins(env) {
  return getEnv(env, 'APP_ORIGIN')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

function getRequestOrigin(request, env) {
  return getConfiguredOrigins(env)[0] ?? new URL(request.url).origin ?? defaultOrigin
}

function isAllowedOrigin(request, env, origin) {
  const normalizedOrigin = String(origin ?? '').trim().replace(/\/+$/, '')
  if (!normalizedOrigin) {
    return true
  }

  const allowedOrigins = new Set(getConfiguredOrigins(env))
  allowedOrigins.add(new URL(request.url).origin)
  return allowedOrigins.has(normalizedOrigin)
}

function getCorsHeaders(request, env) {
  const headers = getSecurityHeaders()
  const origin = request.headers.get('Origin')

  if (!origin || !isAllowedOrigin(request, env, origin)) {
    return headers
  }

  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-multica-guest-token')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Vary', 'Origin')
  return headers
}

function verifyOrigin(request, env) {
  const origin = request.headers.get('Origin')
  if (!origin || isAllowedOrigin(request, env, origin)) {
    return
  }

  throw new HttpError(403, 'Origin is not allowed.')
}

function sendJson(request, env, payload, status = 200) {
  const headers = getCorsHeaders(request, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(payload), { status, headers })
}

function sendText(request, env, body, contentType, status = 200) {
  const headers = getCorsHeaders(request, env)
  headers.set('Content-Type', contentType)
  return new Response(body, { status, headers })
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get('Content-Length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > bodyLimitBytes) {
    throw new HttpError(413, 'Request body is too large.')
  }

  try {
    return await request.json()
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
}

async function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  const requestHeaders = new Headers(headers)
  let requestBody

  if (body instanceof URLSearchParams) {
    requestBody = body.toString()
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded')
    }
  } else if (body) {
    requestBody = JSON.stringify(body)
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json')
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, 'The payment provider rejected the configured API credentials.')
    }

    const message =
      payload?.message ??
      payload?.error ??
      payload?.error_description ??
      payload?.details?.message ??
      payload?.details?.[0]?.description ??
      `Payment request failed with status ${response.status}.`
    throw new HttpError(502, message)
  }

  return payload
}

function getCheckoutUrl(payload) {
  for (const candidate of [payload?.checkout_url, payload?.checkoutUrl, payload?.url]) {
    if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
      return String(candidate).trim()
    }
  }

  const links = Array.isArray(payload?.links) ? payload.links : []
  const checkoutLink = links.find((link) => {
    const rel = String(link?.rel ?? '').toLowerCase()
    return rel === 'checkout' || rel === 'payment' || rel === 'payer-action' || rel === 'approve'
  })

  return typeof checkoutLink?.href === 'string' && checkoutLink.href.trim() ? checkoutLink.href.trim() : null
}

function canUseHostedReturnUrl(origin) {
  return !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('[::1]')
}

function getPaymentProvider(env) {
  const configuredProvider = getEnv(env, 'PAYMENT_PROVIDER').toLowerCase()
  if (configuredProvider === 'creem' || configuredProvider === 'paypal') {
    return configuredProvider
  }

  return 'creem'
}

async function getCreemSettings(env) {
  const environmentSetting = firstEnv(env, 'CREEM_ENV', 'CREEM_MODE').toLowerCase()
  const testApiKey = await firstSecretEnv(env, 'API_TEST_KEY', 'CREEM_TEST_KEY', 'creem_test_key')
  const liveApiKey = await firstSecretEnv(env, 'API_PROD_KEY', 'CREEM_API_KEY', 'CREEM_KEY')
  const isTestMode =
    environmentSetting === 'test'
      ? true
      : environmentSetting === 'live' || environmentSetting === 'production'
        ? false
        : Boolean(testApiKey) && !liveApiKey
  const apiKey = isTestMode ? testApiKey : liveApiKey || testApiKey
  const baseUrl = getEnv(env, 'CREEM_BASE_URL') || (isTestMode ? 'https://test-api.creem.io' : 'https://api.creem.io')

  return { apiKey, baseUrl, isTestMode }
}

async function getPayPalSettings(env) {
  const environment = firstEnv(env, 'PAYPAL_ENV').toLowerCase()
  const isLive = environment === 'live' || environment === 'production'

  return {
    clientId: await firstSecretEnv(env, 'PAY_CLIENT_ID', 'PAYPAL_CLIENT_ID'),
    secret: await firstSecretEnv(env, 'PAY_SECRET', 'PAYPAL_CLIENT_SECRET'),
    baseUrl: getEnv(env, 'PAYPAL_BASE_URL') || (isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'),
  }
}

function buildHostedReturnUrl(request, env, provider, state, order = null) {
  const origin = getRequestOrigin(request, env)
  if (order?.id) {
    const guestTokenQuery = order.guestToken || order.guest_token ? `&guest_token=${encodeURIComponent(order.guestToken ?? order.guest_token)}` : ''
    return `${origin}/console?order=${encodeURIComponent(order.id)}${guestTokenQuery}`
  }

  return `${origin}/?checkout=${state}&provider=${provider}`
}

function randomId(byteLength = 16) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeProductKey(value) {
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getConfiguredCreemProductId(env, { planSelection, model, amountCents, currency }) {
  return (
    firstEnv(
      env,
      `CREEM_PRODUCT_ID_${normalizeProductKey(`${planSelection.plan.id}_${planSelection.billingCycle}_${model.id}`)}`,
      `CREEM_PRODUCT_ID_${normalizeProductKey(`${planSelection.plan.id}_${planSelection.billingCycle}_${amountCents}_${currency}`)}`,
      `CREEM_PRODUCT_ID_${normalizeProductKey(planSelection.plan.id)}`,
      'CREEM_PRODUCT_ID',
    ) || null
  )
}

async function createCreemCheckout({ env, order, planSelection, model, channel, request, stateless = true }) {
  const { apiKey, baseUrl, isTestMode } = await getCreemSettings(env)
  if (!apiKey) {
    throw new HttpError(503, 'Creem payment is not configured for this Cloudflare deployment.')
  }

  const cacheKey = `${isTestMode ? 'test' : 'live'}:${planSelection.planId}:${model.id}:${order.amountCents}:${order.currency}`
  let productId =
    getConfiguredCreemProductId(env, {
      planSelection,
      model,
      amountCents: order.amountCents,
      currency: order.currency,
    }) ?? creemProductCache.get(cacheKey)

  const origin = getRequestOrigin(request, env)
  const headers = { 'x-api-key': apiKey }

  if (!productId) {
    const product = await requestJson(`${baseUrl}/v1/products`, {
      method: 'POST',
      headers,
      body: {
        name: `TradingAgents ${planSelection.plan.name} ${planSelection.billingCycle === 'annual' ? 'Annual' : 'Monthly'}`,
        description: `${planSelection.plan.subtitle} - ${order.amountLabel}`,
        price: order.amountCents,
        currency: order.currency,
        billing_type: 'onetime',
        tax_mode: 'inclusive',
        tax_category: 'saas',
        ...(canUseHostedReturnUrl(origin)
          ? {
              default_success_url: buildHostedReturnUrl(request, env, 'creem', 'success', stateless ? null : order),
            }
          : {}),
      },
    })
    productId = product.id
    if (!productId) {
      throw new HttpError(502, 'Creem product did not return an id.')
    }
    creemProductCache.set(cacheKey, productId)
  }

  const checkout = await requestJson(`${baseUrl}/v1/checkouts`, {
    method: 'POST',
    headers,
    body: {
      product_id: productId,
      request_id: order.id,
      success_url: buildHostedReturnUrl(request, env, 'creem', 'success', stateless ? null : order),
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        planId: planSelection.planId,
        modelId: model.id,
        channelId: channel.id,
        stateless,
      },
    },
  })

  const checkoutUrl = getCheckoutUrl(checkout)
  if (!checkoutUrl) {
    throw new HttpError(502, 'Creem checkout did not return a hosted checkout URL.')
  }

  return { checkoutUrl, checkoutId: checkout.id ?? checkout.checkout_id ?? checkout.checkoutId ?? null }
}

async function createPayPalCheckout({ env, order, planSelection, request, stateless = true }) {
  const { clientId, secret, baseUrl } = await getPayPalSettings(env)
  if (!clientId || !secret) {
    throw new HttpError(503, 'PayPal payment is not configured for this Cloudflare deployment.')
  }

  const accessTokenPayload = await requestJson(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  const checkout = await requestJson(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessTokenPayload.access_token}`,
    },
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.id,
          custom_id: order.id,
          description: `TradingAgents ${planSelection.plan.name} ${planSelection.billingCycle === 'annual' ? 'Yearly' : 'Monthly'}`,
          amount: {
            currency_code: order.currency,
            value: (order.amountCents / 100).toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'TradingAgents',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: buildHostedReturnUrl(request, env, 'paypal', 'success', stateless ? null : order),
            cancel_url: buildHostedReturnUrl(request, env, 'paypal', 'cancelled', stateless ? null : order),
          },
        },
      },
    },
  })

  const checkoutUrl = getCheckoutUrl(checkout)
  if (!checkoutUrl) {
    throw new HttpError(502, 'PayPal checkout did not return a hosted checkout URL.')
  }

  return { checkoutUrl, paypalOrderId: checkout.id ?? null }
}

function serializePlan(plan) {
  const annualAmountCents = Math.round(plan.monthlyAmountCents * 12 * annualBillingMultiplier)

  return {
    ...plan,
    annualAmountCents,
    annualPriceLabel: formatMoney(annualAmountCents, plan.currency),
  }
}

async function createStatelessCheckout(body, request, env) {
  const model = getModelById(String(body.modelId ?? 'gpt-5-4'))
  const planSelection = resolvePlanSelection(String(body.planId ?? 'growth:annual'), { model })
  const channel = getChannelById(String(body.channelId ?? 'telegram'))
  validateCommunicationToken(channel.id, String(body.communicationToken ?? '').trim())

  const order = {
    id: randomId(16),
    orderNumber: `mca-${Date.now().toString().slice(-8)}`,
    amountCents: planSelection.amountCents,
    amountLabel: formatMoney(planSelection.amountCents, planSelection.plan.currency),
    currency: planSelection.plan.currency,
  }

  const paymentProvider = getPaymentProvider(env)
  const checkout =
    paymentProvider === 'creem'
      ? await createCreemCheckout({ env, order, planSelection, model, channel, request })
      : await createPayPalCheckout({ env, order, planSelection, request })

  return {
    message: 'Checkout is ready.',
    orderId: order.id,
    orderNumber: order.orderNumber,
    planId: planSelection.planId,
    modelId: model.id,
    channelId: channel.id,
    amountCents: order.amountCents,
    amountLabel: order.amountLabel,
    currency: order.currency,
    checkoutUrl: checkout.checkoutUrl,
    paymentProvider,
    creemCheckoutId: checkout.checkoutId ?? null,
    paypalOrderId: checkout.paypalOrderId ?? null,
    paypalClientId: paymentProvider === 'paypal' ? (await firstSecretEnv(env, 'PAY_CLIENT_ID', 'PAYPAL_CLIENT_ID')) || null : null,
    stateless: true,
  }
}

function hasD1Database(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === 'function')
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeBindParams(params) {
  return params.map((value) => (value === undefined ? null : value))
}

function d1Statement(env, sql) {
  const database = env.DB
  return {
    async get(...params) {
      return (await database.prepare(sql).bind(...normalizeBindParams(params)).first()) ?? null
    },
    async all(...params) {
      const result = await database.prepare(sql).bind(...normalizeBindParams(params)).all()
      return result.results ?? []
    },
    async run(...params) {
      const result = await database.prepare(sql).bind(...normalizeBindParams(params)).run()
      return {
        changes: Number(result.meta?.changes ?? result.changes ?? 0),
      }
    },
  }
}

function parseCookies(request) {
  const cookies = {}
  const rawCookie = request.headers.get('Cookie') ?? ''

  rawCookie.split(';').forEach((item) => {
    const [key, ...value] = item.trim().split('=')
    if (!key) {
      return
    }

    cookies[key] = decodeURIComponent(value.join('='))
  })

  return cookies
}

function getGuestToken(request) {
  const cookies = parseCookies(request)
  const cookieToken = cookies[guestCookieName]
  if (cookieToken) {
    return cookieToken
  }

  const headerToken = request.headers.get('x-multica-guest-token')
  if (headerToken?.trim()) {
    return headerToken.trim()
  }

  const url = new URL(request.url)
  const queryToken = url.searchParams.get('guest_token')
  return queryToken?.trim() || null
}

function getCookieSecuritySuffix(request) {
  return new URL(request.url).protocol === 'https:' ? '; Secure' : ''
}

function buildCookie(name, value, request, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${getCookieSecuritySuffix(request)}`
}

function clearCookie(name, request) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${getCookieSecuritySuffix(request)}`
}

function appendCookies(response, cookies) {
  for (const cookie of cookies.filter(Boolean)) {
    response.headers.append('Set-Cookie', cookie)
  }

  return response
}

function textToBytes(value) {
  return new TextEncoder().encode(value)
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', textToBytes(value)))
}

async function hashPassword(password) {
  const salt = randomId(16)
  const iterations = 100_000
  const key = await crypto.subtle.importKey('raw', textToBytes(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(salt),
      iterations,
    },
    key,
    256,
  )
  return `pbkdf2-sha256:${iterations}:${salt}:${bytesToHex(bits)}`
}

async function verifyPassword(password, storedHash) {
  const [scheme, iterationText, salt, expectedHash] = String(storedHash ?? '').split(':')
  const iterations = Number.parseInt(iterationText, 10)
  if (scheme !== 'pbkdf2-sha256' || !Number.isFinite(iterations) || !salt || !expectedHash) {
    return false
  }

  const key = await crypto.subtle.importKey('raw', textToBytes(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(salt),
      iterations,
    },
    key,
    256,
  )
  return bytesToHex(bits) === expectedHash
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function sanitizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePasswordInput(password) {
  const value = String(password ?? '').trim()
  if (value.length < 12 || value.length > 128) {
    throw new HttpError(400, 'Password must be between 12 and 128 characters.')
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    throw new HttpError(400, 'Password must include uppercase, lowercase, and numeric characters.')
  }
}

function validateNameInput(name) {
  if (name.length < 2 || name.length > 80) {
    throw new HttpError(400, 'Name must be between 2 and 80 characters.')
  }
}

function serializeUser(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  }
}

function getConfiguredAdminEmails(env) {
  return firstEnv(env, 'ADMIN_ALLOWED_EMAILS', 'GENERICAGENT_ADMIN_EMAILS')
    .split(/[,\s]+/)
    .map((item) => normalizeEmail(item))
    .filter(Boolean)
}

async function resolveNewUserRole(env, email, requestedRole = 'operator') {
  const configuredAdminEmails = getConfiguredAdminEmails(env)
  if (configuredAdminEmails.includes(email)) {
    return 'admin'
  }

  if (configuredAdminEmails.length > 0) {
    return requestedRole === 'admin' ? 'admin' : 'operator'
  }

  const activeUsers = await d1Statement(
    env,
    `SELECT COUNT(*) AS count FROM users WHERE email != ? AND status = 'active'`,
  ).get(guestUserEmail)
  if (Number(activeUsers?.count ?? 0) === 0) {
    return 'admin'
  }

  return requestedRole === 'admin' ? 'admin' : 'operator'
}

async function ensureGuestUser(env) {
  const existing = await d1Statement(env, `SELECT * FROM users WHERE email = ?`).get(guestUserEmail)
  if (existing) {
    return existing
  }

  const timestamp = nowIso()
  await d1Statement(
    env,
    `INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run('guest-user', guestUserEmail, 'Guest checkout', 'disabled', 'operator', 'disabled', timestamp, timestamp)
  return await d1Statement(env, `SELECT * FROM users WHERE email = ?`).get(guestUserEmail)
}

async function createSessionForUser(env, userId) {
  const token = randomId(32)
  const timestamp = nowIso()
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000).toISOString()
  await d1Statement(
    env,
    `INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomId(16), userId, await sha256Hex(token), timestamp, timestamp, expiresAt)
  return token
}

async function getAuthenticatedContext(request, env) {
  if (!hasD1Database(env)) {
    return null
  }

  const token = parseCookies(request)[sessionCookieName]
  if (!token) {
    return null
  }

  const tokenHash = await sha256Hex(token)
  const session = await d1Statement(
    env,
    `SELECT
       sessions.id AS session_id,
       sessions.user_id,
       sessions.expires_at,
       users.id,
       users.email,
       users.name,
       users.role,
       users.status,
       users.created_at,
       users.updated_at,
       users.last_login_at
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?`,
  ).get(tokenHash)

  if (!session) {
    return null
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    await d1Statement(env, `DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash)
    return null
  }

  if (session.status !== 'active') {
    await d1Statement(env, `DELETE FROM sessions WHERE user_id = ?`).run(session.user_id)
    return null
  }

  await d1Statement(env, `UPDATE sessions SET last_seen_at = ? WHERE id = ?`).run(nowIso(), session.session_id)
  return {
    kind: 'user',
    user: serializeUser(session),
    token,
  }
}

async function getAccessContext(request, env) {
  const authContext = await getAuthenticatedContext(request, env)
  const guestToken = getGuestToken(request)
  if (authContext) {
    return {
      ...authContext,
      guestToken,
    }
  }

  return guestToken ? { kind: 'guest', guestToken } : null
}

async function requireOrderAccessContext(request, env) {
  const context = await getAccessContext(request, env)
  if (!context) {
    throw new HttpError(401, 'Authentication or guest access required.')
  }
  return context
}

async function requireAuthenticatedUser(request, env) {
  const context = await getAuthenticatedContext(request, env)
  if (!context) {
    throw new HttpError(401, 'Authentication required.')
  }
  return context
}

async function requireAdminUser(request, env) {
  const context = await requireAuthenticatedUser(request, env)
  if (context.user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required.')
  }
  return context
}

async function assertD1OrderAccess(context, order) {
  if (!order) {
    throw new HttpError(404, 'Order not found.')
  }

  if (context.kind === 'guest') {
    if (order.guest_token !== context.guestToken) {
      throw new HttpError(403, 'Order access denied.')
    }
    return
  }

  if (
    context.user.role !== 'admin' &&
    order.user_id !== context.user.id &&
    (!context.guestToken || order.guest_token !== context.guestToken)
  ) {
    throw new HttpError(403, 'Order access denied.')
  }
}

function maskCommunicationToken(token) {
  const value = String(token ?? '').trim()
  if (!value) {
    return 'No token provided'
  }

  return `${value.slice(0, 4)}****`
}

function getOrderIncludedDeployments(row) {
  const configured = Number(row?.included_deployments)
  if (Number.isFinite(configured) && configured > 0) {
    return configured
  }

  const planId = String(row?.plan_id ?? '')
  if (planId.startsWith('scale:')) {
    return 20
  }

  if (planId.startsWith('growth:')) {
    return 5
  }

  return 1
}

async function getReservedDeploymentCount(env, orderId) {
  const row = await d1Statement(
    env,
    `SELECT COUNT(*) AS count
     FROM deployments
     WHERE order_id = ?
       AND status IN ('queued', 'provisioning', 'deployed')`,
  ).get(orderId)
  return Number(row?.count ?? 0)
}

function serializeDeployment(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    instanceName: row.instance_name,
    status: row.status,
    triggerMode: row.trigger_mode,
    sequenceNumber: row.sequence_number,
    progress: row.progress,
    etaMinutes: row.eta_minutes,
    targetServer: row.target_server,
    workspacePath: row.workspace_path,
    consoleUrl: row.console_url,
    publicEndpoint: row.public_endpoint,
    runtimeUser: row.runtime_user,
    serviceName: row.service_name,
    lastMessage: row.last_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  }
}

function serializeAgentInstance(row) {
  if (!row) {
    return null
  }

  const model = getModelById(row.model_id)
  const channel = getChannelById(row.channel_id)
  return {
    id: row.id,
    orderId: row.order_id,
    deploymentId: row.deployment_id,
    sequenceNumber: row.sequence_number,
    instanceName: row.instance_name,
    modelId: row.model_id,
    modelName: model.name,
    channelId: row.channel_id,
    channelName: channel.name,
    status: row.status,
    targetServer: row.target_server,
    workspacePath: row.workspace_path,
    consoleUrl: row.console_url,
    publicEndpoint: row.public_endpoint,
    runtimeUser: row.runtime_user,
    serviceName: row.service_name,
    runtimeState: row.runtime_state ?? (row.status === 'running' ? 'running' : null),
    multicaVersion: row.multica_version ?? 'not-deployed',
    upgradeStatus: row.upgrade_status ?? 'idle',
    upgradeTargetVersion: row.upgrade_target_version,
    upgradeError: row.upgrade_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function serializeOrder(env, row, viewerContext = null) {
  const planSelection = resolvePlanSelection(row.plan_id, { modelId: row.model_id })
  const plan = planSelection.plan
  const model = getModelById(row.model_id)
  const channel = getChannelById(row.channel_id)
  const deployments = (
    await d1Statement(
      env,
      `SELECT * FROM deployments WHERE order_id = ? ORDER BY sequence_number DESC, created_at DESC`,
    ).all(row.id)
  ).map(serializeDeployment)
  const deployment = deployments[0] ?? null
  const instance = serializeAgentInstance(
    await d1Statement(
      env,
      `SELECT * FROM agent_instances WHERE order_id = ? ORDER BY sequence_number DESC, created_at DESC LIMIT 1`,
    ).get(row.id),
  )
  const includedDeployments = getOrderIncludedDeployments(row)
  const reservedDeployments = await getReservedDeploymentCount(env, row.id)
  const guestTokenQuery = row.guest_token ? `&guest_token=${encodeURIComponent(row.guest_token)}` : ''
  const deploymentStatus = deployment?.status ?? row.deployment_status
  const statusMessage = deployment?.lastMessage ?? row.status_message

  return {
    id: row.id,
    orderNumber: row.order_number,
    planId: row.plan_id,
    planName: `${plan.name} - ${planSelection.billingCycle === 'annual' ? 'Yearly' : 'Monthly'}`,
    amountCents: row.amount_cents,
    amountLabel: formatMoney(row.amount_cents, row.currency),
    currency: row.currency,
    modelId: row.model_id,
    modelName: model.name,
    channelId: row.channel_id,
    channelName: channel.name,
    paymentStatus: row.payment_status,
    deploymentStatus,
    statusMessage,
    deploymentEtaMinutes: row.deployment_eta_minutes,
    includedDeployments,
    deploymentsUsed: reservedDeployments,
    deploymentsRemaining: Math.max(includedDeployments - reservedDeployments, 0),
    canTriggerDeployment: row.payment_status === 'paid' && reservedDeployments < includedDeployments,
    bindingStatus: row.guest_token ? 'unbound' : 'bound',
    tokenDisplay: row.token_display ?? 'Token unavailable',
    canAdminDeleteMultica: viewerContext?.kind === 'user' && viewerContext.user?.role === 'admin' && Boolean(instance),
    multicaVersion: instance?.multicaVersion ?? 'not-deployed',
    upgradeStatus: instance?.upgradeStatus ?? 'idle',
    upgradeTargetVersion: instance?.upgradeTargetVersion ?? null,
    upgradeError: instance?.upgradeError ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    checkoutPath: `/checkout?order=${row.id}${guestTokenQuery}`,
    consolePath: `/console?order=${row.id}${guestTokenQuery}`,
    deployment,
    deployments,
    instance,
  }
}

function createPaymentOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    amountCents: row.amount_cents,
    amountLabel: formatMoney(row.amount_cents, row.currency),
    currency: row.currency,
    guestToken: row.guest_token,
  }
}

async function createCheckoutSessionForD1Order(env, request, order, viewerContext = null) {
  if (order.payment_status === 'paid') {
    return {
      message: 'This order has already been paid.',
      order: await serializeOrder(env, order, viewerContext),
      checkoutUrl: null,
      paymentProvider: getPaymentProvider(env),
      creemCheckoutId: order.creem_checkout_id ?? null,
      paypalOrderId: order.paypal_order_id ?? null,
      paypalClientId: null,
    }
  }

  const model = getModelById(order.model_id)
  const planSelection = resolvePlanSelection(order.plan_id, { model })
  const channel = getChannelById(order.channel_id)
  const paymentProvider = getPaymentProvider(env)
  const paymentOrder = createPaymentOrder(order)

  if (paymentProvider === 'creem') {
    const checkout = await createCreemCheckout({
      env,
      order: paymentOrder,
      planSelection,
      model,
      channel,
      request,
      stateless: false,
    })
    let orderWithCheckout = order
    if (checkout.checkoutId) {
      await d1Statement(env, `UPDATE orders SET creem_checkout_id = ?, updated_at = ? WHERE id = ?`).run(
        checkout.checkoutId,
        nowIso(),
        order.id,
      )
      orderWithCheckout = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(order.id)
    }

    return {
      message: 'Creem checkout is ready.',
      order: await serializeOrder(env, orderWithCheckout, viewerContext),
      checkoutUrl: checkout.checkoutUrl,
      paymentProvider: 'creem',
      creemCheckoutId: checkout.checkoutId ?? null,
      paypalOrderId: null,
      paypalClientId: null,
    }
  }

  const checkout = await createPayPalCheckout({
    env,
    order: paymentOrder,
    planSelection,
    request,
    stateless: false,
  })
  let orderWithCheckout = order
  if (checkout.paypalOrderId) {
    await d1Statement(env, `UPDATE orders SET paypal_order_id = ?, updated_at = ? WHERE id = ?`).run(
      checkout.paypalOrderId,
      nowIso(),
      order.id,
    )
    orderWithCheckout = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(order.id)
  }

  return {
    message: 'PayPal checkout is ready.',
    order: await serializeOrder(env, orderWithCheckout, viewerContext),
    checkoutUrl: checkout.checkoutUrl,
    paymentProvider: 'paypal',
    creemCheckoutId: null,
    paypalOrderId: checkout.paypalOrderId ?? null,
    paypalClientId: (await firstSecretEnv(env, 'PAY_CLIENT_ID', 'PAYPAL_CLIENT_ID')) || null,
  }
}

function buildOrderNumber() {
  return `mca-${Date.now().toString().slice(-8)}-${randomId(2)}`
}

async function createD1LaunchCheckout(body, request, env) {
  const authContext = await getAuthenticatedContext(request, env)
  const model = getModelById(String(body.modelId ?? 'gpt-5-4'))
  const planSelection = resolvePlanSelection(String(body.planId ?? 'growth:annual'), { model })
  const channel = getChannelById(String(body.channelId ?? 'telegram'))
  const communicationToken = String(body.communicationToken ?? '').trim()
  validateCommunicationToken(channel.id, communicationToken)

  const guestToken = authContext ? null : getGuestToken(request) ?? randomId(18)
  const ownerUser = authContext?.user ?? (await ensureGuestUser(env))
  const timestamp = nowIso()
  const orderId = randomId(16)

  await d1Statement(
    env,
    `INSERT INTO orders (
       id, order_number, user_id, guest_token, plan_id, model_id, channel_id,
       token_cipher_text, token_iv, token_tag, token_display,
       amount_cents, currency, payment_status, deployment_status, status_message,
       deployment_eta_minutes, included_deployments, created_at, updated_at,
       creem_checkout_id, paypal_order_id, paid_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
  ).run(
    orderId,
    buildOrderNumber(),
    ownerUser.id,
    guestToken,
    planSelection.planId,
    model.id,
    channel.id,
    'worker:not-stored',
    '',
    '',
    maskCommunicationToken(communicationToken),
    planSelection.amountCents,
    planSelection.plan.currency,
    'pending',
    'awaiting_payment',
    'Awaiting payment confirmation before deployment starts.',
    planSelection.plan.etaMinutes,
    planSelection.plan.includedDeployments,
    timestamp,
    timestamp,
  )

  const order = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(orderId)
  const checkout = await createCheckoutSessionForD1Order(
    env,
    request,
    order,
    authContext ?? (guestToken ? { kind: 'guest', guestToken } : null),
  )
  return {
    payload: {
      message: checkout.message,
      orderId: checkout.order.id,
      orderNumber: checkout.order.orderNumber,
      planId: checkout.order.planId,
      modelId: checkout.order.modelId,
      channelId: checkout.order.channelId,
      amountCents: checkout.order.amountCents,
      amountLabel: checkout.order.amountLabel,
      currency: checkout.order.currency,
      checkoutUrl: checkout.checkoutUrl,
      paymentProvider: checkout.paymentProvider,
      creemCheckoutId: checkout.creemCheckoutId ?? null,
      paypalOrderId: checkout.paypalOrderId ?? null,
      paypalClientId: checkout.paypalClientId ?? null,
      stateless: false,
      order: checkout.order,
    },
    guestToken,
  }
}

async function listVisibleOrders(env, context) {
  const rows =
    context.kind === 'guest'
      ? await d1Statement(env, `SELECT * FROM orders WHERE guest_token = ? ORDER BY created_at DESC`).all(
          context.guestToken,
        )
      : context.user.role === 'admin'
        ? await d1Statement(env, `SELECT * FROM orders ORDER BY created_at DESC`).all()
        : [
            ...(await d1Statement(env, `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`).all(
              context.user.id,
            )),
            ...(context.guestToken
              ? await d1Statement(env, `SELECT * FROM orders WHERE guest_token = ? ORDER BY created_at DESC`).all(
                  context.guestToken,
                )
              : []),
          ]

  const dedupedRows = Array.from(new Map(rows.map((row) => [row.id, row])).values())
  return await Promise.all(dedupedRows.map((row) => serializeOrder(env, row, context)))
}

async function listVisibleAgentInstances(env, context) {
  const rows =
    context.kind === 'guest'
      ? await d1Statement(
          env,
          `SELECT agent_instances.*
           FROM agent_instances
           INNER JOIN orders ON orders.id = agent_instances.order_id
           WHERE orders.guest_token = ?
           ORDER BY agent_instances.created_at DESC`,
        ).all(context.guestToken)
      : context.user.role === 'admin'
        ? await d1Statement(env, `SELECT * FROM agent_instances ORDER BY created_at DESC`).all()
        : [
            ...(await d1Statement(env, `SELECT * FROM agent_instances WHERE user_id = ? ORDER BY created_at DESC`).all(
              context.user.id,
            )),
            ...(context.guestToken
              ? await d1Statement(
                  env,
                  `SELECT agent_instances.*
                   FROM agent_instances
                   INNER JOIN orders ON orders.id = agent_instances.order_id
                   WHERE orders.guest_token = ?
                   ORDER BY agent_instances.created_at DESC`,
                ).all(context.guestToken)
              : []),
          ]

  return Array.from(new Map(rows.map((row) => [row.id, row])).values()).map(serializeAgentInstance)
}

const analyticsSql = {
  createSession: `INSERT INTO analytics_sessions (
    id, visitor_id, user_id, landing_path, referrer_host, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, device_type, browser_language, event_count, click_count,
    section_view_count, page_view_count, last_event_name, last_route_path, last_stage,
    started_at, last_seen_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  updateSession: `UPDATE analytics_sessions
    SET visitor_id = ?,
      user_id = COALESCE(?, user_id),
      referrer_host = COALESCE(referrer_host, ?),
      utm_source = COALESCE(utm_source, ?),
      utm_medium = COALESCE(utm_medium, ?),
      utm_campaign = COALESCE(utm_campaign, ?),
      utm_term = COALESCE(utm_term, ?),
      utm_content = COALESCE(utm_content, ?),
      device_type = COALESCE(device_type, ?),
      browser_language = COALESCE(browser_language, ?),
      event_count = event_count + ?,
      click_count = click_count + ?,
      section_view_count = section_view_count + ?,
      page_view_count = page_view_count + ?,
      last_event_name = ?,
      last_route_path = ?,
      last_stage = ?,
      started_at = CASE WHEN started_at < ? THEN started_at ELSE ? END,
      last_seen_at = ?,
      updated_at = ?
    WHERE id = ?`,
  createEvent: `INSERT INTO analytics_events (
    id, visitor_id, session_id, user_id, order_id, event_type, event_name, route_path,
    page_key, section_key, element_key, referrer_host, metadata_json, occurred_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO NOTHING`,
}

function createWorkerAnalyticsHelpers(env) {
  return createAnalyticsHelpers({
    analyticsRateLimiter: null,
    assertOrderAccess: (context, order) => assertD1OrderAccess(context, order),
    countAnalyticsSessionsSinceStatement: d1Statement(
      env,
      `SELECT COUNT(*) AS count FROM analytics_sessions WHERE started_at >= ?`,
    ),
    countDistinctAnalyticsSessionsByEventNameSinceStatement: d1Statement(
      env,
      `SELECT COUNT(DISTINCT session_id) AS count FROM analytics_events WHERE occurred_at >= ? AND event_name = ?`,
    ),
    countDistinctAnalyticsSessionsByPagePathSinceStatement: d1Statement(
      env,
      `SELECT COUNT(DISTINCT session_id) AS count
       FROM analytics_events
       WHERE occurred_at >= ? AND event_name = 'page_view' AND route_path = ?`,
    ),
    countDistinctAnalyticsSessionsBySectionSinceStatement: d1Statement(
      env,
      `SELECT COUNT(DISTINCT session_id) AS count
       FROM analytics_events
       WHERE occurred_at >= ? AND event_name = 'content_view' AND section_key = ?`,
    ),
    countDistinctAnalyticsVisitorsSinceStatement: d1Statement(
      env,
      `SELECT COUNT(DISTINCT visitor_id) AS count FROM analytics_sessions WHERE started_at >= ?`,
    ),
    createAnalyticsSessionStatement: d1Statement(env, analyticsSql.createSession),
    createAnalyticsEventStatement: d1Statement(env, analyticsSql.createEvent),
    enforceRateLimit: () => {},
    findAnalyticsSessionByIdStatement: d1Statement(env, `SELECT * FROM analytics_sessions WHERE id = ?`),
    findOrderByIdStatement: d1Statement(env, `SELECT * FROM orders WHERE id = ?`),
    getAuthenticatedContext: (request) => getAuthenticatedContext(request, env),
    getGuestToken,
    listAnalyticsDropOffStagesSinceStatement: d1Statement(
      env,
      `SELECT COALESCE(last_stage, 'unknown') AS stage, COUNT(*) AS count
       FROM analytics_sessions
       WHERE started_at >= ? AND COALESCE(last_stage, 'unknown') != 'payment_completed'
       GROUP BY COALESCE(last_stage, 'unknown')
       ORDER BY count DESC, stage ASC
       LIMIT ?`,
    ),
    listAnalyticsEventsBySessionIdStatement: d1Statement(
      env,
      `SELECT * FROM analytics_events WHERE session_id = ? ORDER BY occurred_at ASC, created_at ASC`,
    ),
    listAnalyticsSessionsSinceStatement: d1Statement(
      env,
      `SELECT * FROM analytics_sessions WHERE started_at >= ? ORDER BY last_seen_at DESC LIMIT ?`,
    ),
    listAnalyticsTopCtaClicksSinceStatement: d1Statement(
      env,
      `SELECT COALESCE(element_key, 'unknown') AS key,
        COALESCE(section_key, 'unknown') AS section,
        COUNT(*) AS clicks,
        COUNT(DISTINCT session_id) AS sessions
       FROM analytics_events
       WHERE occurred_at >= ? AND event_type = 'click' AND event_name = 'cta_click'
       GROUP BY COALESCE(element_key, 'unknown'), COALESCE(section_key, 'unknown')
       ORDER BY clicks DESC, sessions DESC, key ASC
       LIMIT ?`,
    ),
    listAnalyticsTopReferrersSinceStatement: d1Statement(
      env,
      `SELECT COALESCE(referrer_host, '(direct)') AS host, COUNT(*) AS count
       FROM analytics_sessions
       WHERE started_at >= ?
       GROUP BY COALESCE(referrer_host, '(direct)')
       ORDER BY count DESC, host ASC
       LIMIT ?`,
    ),
    nowIso,
    readJsonBody,
    requireAdminUser: (request) => requireAdminUser(request, env),
    sumAnalyticsSessionMetricsSinceStatement: d1Statement(
      env,
      `SELECT COALESCE(SUM(page_view_count), 0) AS page_views,
        COALESCE(SUM(section_view_count), 0) AS section_views,
        COALESCE(SUM(click_count), 0) AS clicks
       FROM analytics_sessions
       WHERE started_at >= ?`,
    ),
    updateAnalyticsSessionStatement: d1Statement(env, analyticsSql.updateSession),
  })
}

async function createUserRecord(env, { email, name, password, role = 'operator' }) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedName = sanitizeName(name)
  validateNameInput(normalizedName)
  validatePasswordInput(password)
  if (!validateEmail(normalizedEmail)) {
    throw new HttpError(400, 'Enter a valid email address.')
  }

  if (await d1Statement(env, `SELECT id FROM users WHERE email = ?`).get(normalizedEmail)) {
    throw new HttpError(409, 'An account with this email already exists.')
  }

  const timestamp = nowIso()
  const userId = randomId(16)
  const resolvedRole = await resolveNewUserRole(env, normalizedEmail, role)
  await d1Statement(
    env,
    `INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(userId, normalizedEmail, normalizedName, await hashPassword(password), resolvedRole, 'active', timestamp, timestamp)
  return await d1Statement(env, `SELECT * FROM users WHERE id = ?`).get(userId)
}

async function markD1OrderPaid(env, order) {
  if (order.payment_status === 'paid') {
    return order
  }

  const timestamp = nowIso()
  await d1Statement(
    env,
    `UPDATE orders
     SET payment_status = 'paid',
       deployment_status = 'queued',
       status_message = 'Payment confirmed. Manual provisioning queue is ready.',
       paid_at = ?,
       updated_at = ?
     WHERE id = ?`,
  ).run(timestamp, timestamp, order.id)

  const existingDeployment = await d1Statement(env, `SELECT id FROM deployments WHERE order_id = ? LIMIT 1`).get(order.id)
  if (!existingDeployment) {
    await d1Statement(
      env,
      `INSERT INTO deployments (
        id, order_id, user_id, trigger_mode, sequence_number, instance_name, status, progress,
        eta_minutes, target_server, workspace_path, console_url, public_endpoint, runtime_user,
        service_name, console_token_cipher_text, console_token_iv, console_token_tag,
        last_message, run_logs, created_at, started_at, finished_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, NULL, NULL, ?)`,
    ).run(
      randomId(16),
      order.id,
      order.user_id,
      'manual',
      1,
      `tradingagents-${order.order_number.toLowerCase()}`,
      'queued',
      10,
      order.deployment_eta_minutes,
      'cloudflare-manual',
      'Payment confirmed. Waiting for manual provisioning.',
      '',
      timestamp,
      timestamp,
    )
  }

  return await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(order.id)
}

async function getCreemCheckoutSession(env, checkoutId) {
  const { apiKey, baseUrl } = await getCreemSettings(env)
  if (!apiKey) {
    throw new HttpError(503, 'Creem payment is not configured for this Cloudflare deployment.')
  }

  return await requestJson(`${baseUrl}/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`, {
    headers: { 'x-api-key': apiKey },
  })
}

function hasCompletedPayPalCapture(payload) {
  const captures = Array.isArray(payload?.purchase_units)
    ? payload.purchase_units.flatMap((unit) => unit?.payments?.captures ?? [])
    : []
  return captures.some((capture) => String(capture?.status ?? '').toUpperCase() === 'COMPLETED')
}

async function capturePayPalOrder(env, order, payPalOrderId) {
  const normalizedOrderId = String(payPalOrderId ?? '').trim()
  if (!normalizedOrderId) {
    throw new HttpError(400, 'PayPal order ID is required.')
  }

  if (order.paypal_order_id && order.paypal_order_id !== normalizedOrderId) {
    throw new HttpError(400, 'PayPal order ID does not match this checkout.')
  }

  const { clientId, secret, baseUrl } = await getPayPalSettings(env)
  if (!clientId || !secret) {
    throw new HttpError(503, 'PayPal payment is not configured for this Cloudflare deployment.')
  }

  const accessTokenPayload = await requestJson(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  const capture = await requestJson(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(normalizedOrderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessTokenPayload.access_token}`,
    },
    body: {},
  })

  if (String(capture?.status ?? '').toUpperCase() !== 'COMPLETED' && !hasCompletedPayPalCapture(capture)) {
    throw new HttpError(400, 'PayPal payment has not been completed yet.')
  }

  return await markD1OrderPaid(env, order)
}

async function handleD1ApiRequest(request, env) {
  const url = new URL(request.url)

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const context = await getAuthenticatedContext(request, env)
    return sendJson(request, env, { user: context?.user ?? null })
  }

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    const body = await readJsonBody(request)
    const user = await createUserRecord(env, {
      email: body.email,
      name: body.name,
      password: body.password,
    })
    const token = await createSessionForUser(env, user.id)
    const timestamp = nowIso()
    await d1Statement(env, `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).run(timestamp, timestamp, user.id)
    return appendCookies(
      sendJson(request, env, { message: 'Account created. Secure session is active.', user: serializeUser(user) }, 201),
      [buildCookie(sessionCookieName, token, request, sessionTtlSeconds)],
    )
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJsonBody(request)
    const email = normalizeEmail(body.email)
    const user = await d1Statement(env, `SELECT * FROM users WHERE email = ?`).get(email)
    if (!user || !(await verifyPassword(String(body.password ?? ''), user.password_hash))) {
      throw new HttpError(401, 'Email or password is incorrect.')
    }

    if (user.status !== 'active') {
      throw new HttpError(403, 'This user account is disabled.')
    }

    const token = await createSessionForUser(env, user.id)
    const timestamp = nowIso()
    await d1Statement(env, `DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`).run(user.id, await sha256Hex(token))
    await d1Statement(env, `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`).run(timestamp, timestamp, user.id)
    return appendCookies(
      sendJson(request, env, { message: 'Signed in successfully.', user: serializeUser(user) }),
      [buildCookie(sessionCookieName, token, request, sessionTtlSeconds)],
    )
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = parseCookies(request)[sessionCookieName]
    if (token) {
      await d1Statement(env, `DELETE FROM sessions WHERE token_hash = ?`).run(await sha256Hex(token))
    }
    return appendCookies(sendJson(request, env, { message: 'Signed out successfully.' }), [
      clearCookie(sessionCookieName, request),
    ])
  }

  if (url.pathname === '/api/analytics/events' && request.method === 'POST') {
    const result = await createWorkerAnalyticsHelpers(env).ingestAnalyticsEvents(request)
    return sendJson(
      request,
      env,
      {
        message: 'Analytics events accepted.',
        accepted: true,
        persisted: true,
        ...result,
      },
      202,
    )
  }

  if (url.pathname === '/api/admin/analytics/summary' && request.method === 'GET') {
    await requireAdminUser(request, env)
    return sendJson(request, env, {
      summary: await createWorkerAnalyticsHelpers(env).getAdminAnalyticsSummary(url.searchParams.get('days')),
    })
  }

  if (url.pathname === '/api/admin/analytics/sessions' && request.method === 'GET') {
    await requireAdminUser(request, env)
    return sendJson(request, env, {
      sessions: await createWorkerAnalyticsHelpers(env).listAdminAnalyticsSessions({
        days: url.searchParams.get('days'),
        limit: url.searchParams.get('limit'),
      }),
    })
  }

  const analyticsSessionMatch = url.pathname.match(/^\/api\/admin\/analytics\/sessions\/([a-z0-9-]+)$/)
  if (analyticsSessionMatch && request.method === 'GET') {
    await requireAdminUser(request, env)
    return sendJson(request, env, await createWorkerAnalyticsHelpers(env).getAdminAnalyticsSessionDetail(analyticsSessionMatch[1]))
  }

  if (url.pathname === '/api/admin/users' && request.method === 'GET') {
    await requireAdminUser(request, env)
    const users = await d1Statement(
      env,
      `SELECT id, email, name, role, status, created_at, updated_at, last_login_at
       FROM users
       WHERE email != ?
       ORDER BY created_at ASC`,
    ).all(guestUserEmail)
    return sendJson(request, env, { users: users.map(serializeUser) })
  }

  if (url.pathname === '/api/admin/users' && request.method === 'POST') {
    await requireAdminUser(request, env)
    const body = await readJsonBody(request)
    const user = await createUserRecord(env, {
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role === 'admin' ? 'admin' : 'operator',
    })
    return sendJson(request, env, { message: 'User created successfully.', user: serializeUser(user) }, 201)
  }

  const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([a-f0-9]+)$/)
  if (adminUserMatch && request.method === 'PATCH') {
    const context = await requireAdminUser(request, env)
    if (adminUserMatch[1] === context.user.id) {
      throw new HttpError(400, 'Current admin cannot be modified here.')
    }

    const body = await readJsonBody(request)
    const name = sanitizeName(body.name)
    validateNameInput(name)
    const role = body.role === 'admin' ? 'admin' : 'operator'
    const status = body.status === 'disabled' ? 'disabled' : 'active'
    await d1Statement(env, `UPDATE users SET name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?`).run(
      name,
      role,
      status,
      nowIso(),
      adminUserMatch[1],
    )
    const user = await d1Statement(env, `SELECT * FROM users WHERE id = ?`).get(adminUserMatch[1])
    return sendJson(request, env, { message: 'User updated successfully.', user: serializeUser(user) })
  }

  if (url.pathname === '/api/console-data' && request.method === 'GET') {
    const context = await requireOrderAccessContext(request, env)
    return sendJson(request, env, {
      orders: await listVisibleOrders(env, context),
      claws: await listVisibleAgentInstances(env, context),
      users:
        context.kind === 'user' && context.user.role === 'admin'
          ? (await d1Statement(
              env,
              `SELECT id, email, name, role, status, created_at, updated_at, last_login_at
               FROM users
               WHERE email != ?
               ORDER BY created_at ASC`,
            ).all(guestUserEmail)).map(serializeUser)
          : [],
    })
  }

  if (url.pathname === '/api/launch-checkout' && request.method === 'POST') {
    const body = await readJsonBody(request)
    const result = await createD1LaunchCheckout(body, request, env)
    return appendCookies(sendJson(request, env, result.payload), [
      result.guestToken ? buildCookie(guestCookieName, result.guestToken, request, guestTtlSeconds) : null,
    ])
  }

  if (url.pathname === '/api/orders' && request.method === 'GET') {
    const context = await requireOrderAccessContext(request, env)
    return sendJson(request, env, { orders: await listVisibleOrders(env, context) })
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([a-f0-9]+)$/)
  if (orderMatch && request.method === 'GET') {
    const context = await requireOrderAccessContext(request, env)
    const order = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(orderMatch[1])
    await assertD1OrderAccess(context, order)
    return sendJson(request, env, { order: await serializeOrder(env, order, context) })
  }

  const checkoutMatch = url.pathname.match(/^\/api\/orders\/([a-f0-9]+)\/checkout-session$/)
  if (checkoutMatch && request.method === 'POST') {
    const context = await requireOrderAccessContext(request, env)
    const order = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(checkoutMatch[1])
    await assertD1OrderAccess(context, order)
    return sendJson(request, env, await createCheckoutSessionForD1Order(env, request, order, context))
  }

  const creemConfirmMatch = url.pathname.match(/^\/api\/orders\/([a-f0-9]+)\/creem-confirm$/)
  if (creemConfirmMatch && request.method === 'POST') {
    const context = await requireOrderAccessContext(request, env)
    const order = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(creemConfirmMatch[1])
    await assertD1OrderAccess(context, order)
    if (order.payment_status === 'paid') {
      return sendJson(request, env, { message: 'Payment already confirmed.', order: await serializeOrder(env, order, context) })
    }

    const body = await readJsonBody(request)
    const redirectParams = body.redirectParams && typeof body.redirectParams === 'object' ? body.redirectParams : {}
    const checkoutId = String(redirectParams.checkout_id ?? body.checkoutId ?? '').trim()
    if (!checkoutId) {
      throw new HttpError(400, 'Creem redirect payload is incomplete.')
    }

    if (order.creem_checkout_id && checkoutId !== order.creem_checkout_id) {
      throw new HttpError(400, 'Creem checkout does not belong to this order.')
    }

    const checkout = await getCreemCheckoutSession(env, checkoutId)
    const checkoutRequestId = checkout?.request_id ? String(checkout.request_id) : null
    const checkoutStatus = String(checkout?.status ?? '').toLowerCase()
    const orderStatus = String(checkout?.order?.status ?? '').toLowerCase()
    if (checkoutRequestId && checkoutRequestId !== order.id) {
      throw new HttpError(400, 'Creem checkout does not belong to this order.')
    }

    if (checkoutStatus !== 'completed' && orderStatus !== 'paid' && orderStatus !== 'completed') {
      throw new HttpError(400, 'Creem checkout is not completed yet.')
    }

    const paidOrder = await markD1OrderPaid(env, order)
    return sendJson(request, env, {
      message: 'Creem payment confirmed. Your TradingAgents workspace is in the provisioning queue.',
      order: await serializeOrder(env, paidOrder, context),
    })
  }

  const paypalCaptureMatch = url.pathname.match(/^\/api\/orders\/([a-f0-9]+)\/paypal-capture$/)
  if (paypalCaptureMatch && request.method === 'POST') {
    const context = await requireOrderAccessContext(request, env)
    const order = await d1Statement(env, `SELECT * FROM orders WHERE id = ?`).get(paypalCaptureMatch[1])
    await assertD1OrderAccess(context, order)
    const body = await readJsonBody(request)
    const paidOrder = await capturePayPalOrder(env, order, body.paypalOrderId ?? order.paypal_order_id)
    return sendJson(request, env, {
      message: 'PayPal payment confirmed. Your TradingAgents workspace is in the provisioning queue.',
      order: await serializeOrder(env, paidOrder, context),
    })
  }

  return null
}

function normalizeSeoPathname(pathname) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function replaceHeadTag(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }

  return html.replace('</head>', `    ${replacement}\n  </head>`)
}

function getSeoConfig(request, env, pathname) {
  const normalizedPath = normalizeSeoPathname(pathname)
  const origin = getRequestOrigin(request, env)
  const canonicalUrl = new URL(normalizedPath, `${origin}/`).toString()
  const page = seoPageMap.get(normalizedPath)

  if (page) {
    return { ...page, canonicalUrl }
  }

  return {
    title: 'Page not found | TradingAgents',
    description:
      'This TradingAgents page could not be matched to a public route. Return to the homepage to continue.',
    robots: 'noindex,nofollow',
    canonicalUrl,
  }
}

function renderSeoHtml(request, env, pathname, templateHtml) {
  const seo = getSeoConfig(request, env, pathname)

  let html = templateHtml
  html = replaceHeadTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttribute(seo.title)}</title>`)
  html = replaceHeadTag(
    html,
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtmlAttribute(seo.description)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+name="robots"[^>]*>/i,
    `<meta name="robots" content="${escapeHtmlAttribute(seo.robots)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtmlAttribute(seo.canonicalUrl)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+property="og:site_name"[^>]*>/i,
    `<meta property="og:site_name" content="TradingAgents" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtmlAttribute(seo.title)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtmlAttribute(seo.description)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtmlAttribute(seo.canonicalUrl)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttribute(seo.title)}" />`,
  )
  html = replaceHeadTag(
    html,
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtmlAttribute(seo.description)}" />`,
  )

  return html
}

function renderRobotsTxt(request, env) {
  const origin = getRequestOrigin(request, env) || defaultOrigin
  return sendText(request, env, `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, 'text/plain; charset=utf-8')
}

function renderSitemapXml(request, env) {
  const origin = getRequestOrigin(request, env) || defaultOrigin
  const urls = indexableSitemapPaths
    .map((path) => `  <url>\n    <loc>${new URL(path, `${origin}/`).toString()}</loc>\n  </url>`)
    .join('\n')

  return sendText(
    request,
    env,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    'application/xml; charset=utf-8',
  )
}

async function handleApiRequest(request, env) {
  const url = new URL(request.url)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request, env),
    })
  }

  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    verifyOrigin(request, env)
  }

  if (url.pathname === '/api/runtime' && request.method === 'GET') {
    return sendJson(request, env, {
      environment: 'production',
      publicAppOrigin: getRequestOrigin(request, env),
      deploymentMode: 'manual',
      isDevelopment: false,
    })
  }

  if (url.pathname === '/api/catalog' && request.method === 'GET') {
    return sendJson(request, env, {
      plans: planCatalog.map(serializePlan),
      models: modelCatalog,
      channels: channelCatalog,
    })
  }

  if (hasD1Database(env)) {
    const d1Response = await handleD1ApiRequest(request, env)
    if (d1Response) {
      return d1Response
    }
  }

  if (url.pathname === '/api/analytics/events' && request.method === 'POST') {
    return sendJson(
      request,
      env,
      {
        message: 'Analytics events accepted.',
        accepted: true,
        persisted: false,
      },
      202,
    )
  }

  if (url.pathname === '/api/launch-checkout' && request.method === 'POST') {
    const body = await readJsonBody(request)
    return sendJson(request, env, await createStatelessCheckout(body, request, env))
  }

  if (url.pathname === '/api/meta/robots.txt' && request.method === 'GET') {
    return renderRobotsTxt(request, env)
  }

  if (url.pathname === '/api/meta/sitemap.xml' && request.method === 'GET') {
    return renderSitemapXml(request, env)
  }

  return sendJson(request, env, { message: 'Not found.' }, 404)
}

function isHtmlPageRequest(request, url) {
  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    return false
  }

  if (/\.[a-z0-9]+$/i.test(url.pathname)) {
    return false
  }

  const accept = request.headers.get('Accept') ?? ''
  return !accept || accept.includes('text/html') || accept.includes('*/*')
}

async function fetchAsset(request, env, assetFetcher) {
  if (assetFetcher) {
    return await assetFetcher(request, env)
  }

  if (env?.ASSETS?.fetch) {
    return await env.ASSETS.fetch(request)
  }

  return new Response('Cloudflare ASSETS binding is unavailable.', {
    status: 500,
    headers: getSecurityHeaders(),
  })
}

async function fetchSpaAsset(request, env, assetFetcher) {
  const response = await fetchAsset(request, env, assetFetcher)
  if (response.status !== 404) {
    return response
  }

  const indexUrl = new URL('/index.html', request.url)
  return await fetchAsset(new Request(indexUrl, request), env, assetFetcher)
}

async function renderHtmlAsset(request, env, assetFetcher) {
  const url = new URL(request.url)
  const assetResponse = await fetchSpaAsset(request, env, assetFetcher)

  if (!assetResponse.ok) {
    return assetResponse
  }

  const contentType = assetResponse.headers.get('Content-Type') ?? ''
  if (!contentType.includes('text/html')) {
    return assetResponse
  }

  const headers = new Headers(assetResponse.headers)
  const body = renderSeoHtml(request, env, url.pathname, await assetResponse.text())
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Content-Length', String(new TextEncoder().encode(body).length))
  headers.set('Cache-Control', 'no-store')
  for (const [key, value] of getSecurityHeaders()) {
    headers.set(key, value)
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: assetResponse.status,
      headers,
    })
  }

  return new Response(body, {
    status: assetResponse.status,
    headers,
  })
}

export async function handleCloudflareRequest(request, env, options = {}) {
  const url = new URL(request.url)
  const assetFetcher = options.assetFetcher

  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApiRequest(request, env)
    }

    if (url.pathname === '/robots.txt') {
      return renderRobotsTxt(request, env)
    }

    if (url.pathname === '/sitemap.xml') {
      return renderSitemapXml(request, env)
    }

    if (isHtmlPageRequest(request, url)) {
      return await renderHtmlAsset(request, env, assetFetcher)
    }

    const response = await fetchAsset(request, env, assetFetcher)
    const headers = new Headers(response.headers)
    for (const [key, value] of getSecurityHeaders()) {
      headers.set(key, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    const status = error instanceof HttpError ? error.statusCode : 500
    return sendJson(
      request,
      env,
      {
        message: error instanceof Error ? error.message : 'Request failed.',
      },
      status,
    )
  }
}

export default {
  async fetch(request, env) {
    return await handleCloudflareRequest(request, env)
  },
}

