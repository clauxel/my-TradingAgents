import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { channelCatalog, modelCatalog, planCatalog } from '../shared/catalog.mjs'
import { createDeploymentPlanPreview } from '../server-lib/deployment-runtime.mjs'
import { buildModelProxyInternalToken } from '../server-lib/model-proxy-helpers.mjs'
import {
  findRemotePackageTarget,
  normalizeInstanceQuery,
  renderRemotePackageScript,
  resolveRemotePackageRequest,
} from '../scripts/package-remote-multica-instance.mjs'
import {
  loadDeploymentConfig,
  readConfiguredMulticaRepoRef,
} from '../server-lib/deployment-config.mjs'
import { startTestServer } from './helpers/server-test-support.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const tempDirectories = new Set()

after(() => {
  for (const directory of tempDirectories) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createTempDirectory(prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  tempDirectories.add(directory)
  return directory
}

function createTestConfig(configPath, overrides = {}) {
  const baseConfig = {
    deployment: {
      provider: 'mock',
      targetServer: 'mock-node',
      consoleBaseUrl: 'https://console.example.test',
      publicBaseUrl: 'https://public.example.test',
      consolePortBase: 18000,
      consolePortRange: 20000,
      mockRootDir: './mock-remote',
    },
    server: {
      host: '127.0.0.1',
      port: 22,
      username: 'root',
      password: '',
    },
    multica: {
      sourceType: 'git',
      archiveUrl: '',
      archivePath: '',
      repoUrl: 'https://github.com/multica/multica.git',
      repoRef: 'main',
      baseDir: '/srv/multica',
      servicePrefix: 'multica',
      runtimeUserPrefix: 'mca',
      installCommand: 'npm install --no-audit --no-fund',
      buildCommand: 'npm run build',
      startCommand: 'npm run start',
      tokenEnvName: 'COMMUNICATION_TOKEN',
      modelEnvName: 'MULTICA_MODEL_ID',
      channelEnvName: 'MULTICA_CHANNEL_ID',
      planEnvName: 'MULTICA_PLAN_ID',
    },
  }

  const config = {
    ...baseConfig,
    ...overrides,
    deployment: {
      ...baseConfig.deployment,
      ...(overrides.deployment ?? {}),
    },
    server: {
      ...baseConfig.server,
      ...(overrides.server ?? {}),
    },
    multica: {
      ...baseConfig.multica,
      ...(overrides.multica ?? {}),
    },
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function delay(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms)
  })
}

async function waitUntil(predicate, { timeoutMs = 10000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) {
      return value
    }

    await delay(intervalMs)
  }

  throw new Error('Timed out while waiting for condition.')
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.message ?? `Request failed with status ${response.status}.`)
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...payload,
      response,
      payload,
      cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? '',
    }
  }

  return {
    response,
    payload,
    cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? '',
  }
}

async function registerUser(baseUrl, { name, email, password }) {
  return await fetchJson(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  })
}

async function loginUser(baseUrl, { email, password }) {
  return await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  })
}

async function createPaidAndDeployedOrder({
  baseUrl,
  cookie,
  communicationToken,
  creemApiKey,
}) {
  const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      planId: 'starter:monthly',
      modelId: 'gpt-5-4',
      channelId: 'telegram',
      communicationToken,
    }),
  })

  const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
    },
  })

  const creemRedirectParams = {
    checkout_id: checkout.creemCheckoutId,
    product_id: 'CREEM-PRODUCT-1',
    request_id: launch.order.id,
  }
  const signature = createCreemRedirectSignature(creemApiKey, creemRedirectParams)

  await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/creem-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      redirectParams: {
        order: launch.order.id,
        ...creemRedirectParams,
        signature,
      },
    }),
  })

  return await waitUntil(async () => {
    const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
      headers: {
        Cookie: cookie,
      },
    })

    return payload.order.deploymentStatus === 'deployed' ? payload.order : null
  }, {
    timeoutMs: 20000,
    intervalMs: 300,
  })
}

async function performWebSocketUpgrade({ port, path, headers = {} }) {
  return await new Promise((resolvePromise, rejectPromise) => {
    let settled = false
    const resolveOnce = (value) => {
      if (settled) {
        return
      }
      settled = true
      resolvePromise(value)
    }
    const rejectOnce = (error) => {
      if (settled) {
        return
      }
      settled = true
      rejectPromise(error)
    }

    const request = httpRequest({
      hostname: '127.0.0.1',
      port,
      method: 'GET',
      path,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        ...headers,
      },
    })

    request.on('upgrade', (response, socket) => {
      socket.on('error', () => {})
      const statusCode = response.statusCode ?? 0
      socket.destroy()
      resolveOnce(statusCode)
    })

    request.on('response', (response) => {
      let payload = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        payload += chunk
      })
      response.on('end', () => {
        rejectOnce(new Error(`Unexpected HTTP ${response.statusCode}: ${payload}`))
      })
    })

    request.on('error', (error) => {
      if (settled && error?.code === 'ECONNRESET') {
        return
      }
      rejectOnce(error)
    })

    request.end()
  })
}

function createMemoryStorage() {
  const store = new Map()

  return {
    get length() {
      return store.size
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null
    },
    setItem(key, value) {
      store.set(String(key), String(value))
    },
    removeItem(key) {
      store.delete(String(key))
    },
    clear() {
      store.clear()
    },
  }
}

function extractInjectedBootstrap(html) {
  const match = html.match(/<script>\(function\(\)\{[\s\S]*?\}\)\(\);<\/script>/)
  assert.ok(match, 'Expected injected GenericAgent bootstrap script.')
  return match[0].slice('<script>'.length, -'</script>'.length)
}

function evaluateInjectedBootstrap(scriptContent, pageUrl) {
  const localStorage = createMemoryStorage()
  const sessionStorage = createMemoryStorage()
  const webSocketCalls = []
  const document = {
    addEventListener() {},
  }
  function MockWebSocket(url, protocols) {
    webSocketCalls.push({
      url: String(url),
      protocols,
    })
  }
  const window = {
    location: new URL(pageUrl),
    localStorage,
    sessionStorage,
    WebSocket: MockWebSocket,
    addEventListener() {},
    history: {
      state: null,
      pushState(state, title, url) {
        this.state = state
        if (url) {
          window.location = new URL(String(url), window.location.href)
        }
      },
      replaceState(state, title, url) {
        this.state = state
        if (url) {
          window.location = new URL(String(url), window.location.href)
        }
      },
    },
  }

  runInNewContext(scriptContent, {
    window,
    document,
    console,
    URL,
    Element: class Element {},
  })

  return {
    window,
    localStorage,
    sessionStorage,
    webSocketCalls,
  }
}

async function startServer({ port, configPath, dataDir, env = {} }) {
  return await startTestServer({
    port,
    configPath,
    memoryId: dataDir ? `deployment-test:${dataDir}` : undefined,
    resetDatabase: !dataDir,
    env: {
      MULTICA_TOKEN_SECRET: 'test-secret',
      ...env,
    },
  })
}

async function startMockPayPalServer() {
  const requests = []
  const orders = new Map()
  let orderSequence = 1
  let captureSequence = 1

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const chunks = []

    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    const rawBody = Buffer.concat(chunks).toString('utf8')
    const body = rawBody && rawBody.trim().startsWith('{') ? JSON.parse(rawBody) : {}
    requests.push({
      method: request.method,
      pathname: url.pathname,
      search: url.search,
      headers: request.headers,
      body,
    })
    const sendJson = (statusCode, payload) => {
      const text = JSON.stringify(payload)
      response.statusCode = statusCode
      response.setHeader('Content-Type', 'application/json')
      response.end(text)
    }

    if (request.method === 'POST' && url.pathname === '/v1/oauth2/token') {
      sendJson(200, {
        access_token: 'mock-paypal-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/v2/checkout/orders') {
      const id = `PAYPAL-ORDER-${orderSequence++}`
      const purchaseUnits = Array.isArray(body.purchase_units) ? body.purchase_units : []
      orders.set(id, {
        id,
        status: 'APPROVED',
        purchase_units: purchaseUnits,
      })
      sendJson(201, {
        id,
        status: 'CREATED',
        purchase_units: purchaseUnits,
        links: [
          {
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}`,
            rel: 'payer-action',
            method: 'GET',
          },
        ],
      })
      return
    }

    const captureMatch = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/)
    if (request.method === 'POST' && captureMatch) {
      const order = orders.get(captureMatch[1])
      if (!order) {
        sendJson(404, { message: 'Order not found.' })
        return
      }

      if (String(order.status ?? '').toUpperCase() === 'COMPLETED') {
        sendJson(422, {
          message: 'The requested action could not be performed, semantically incorrect, or failed business validation.',
          details: [
            {
              description: 'Order already captured.',
            },
          ],
        })
        return
      }

      const completed = {
        ...order,
        status: 'COMPLETED',
        purchase_units: order.purchase_units.map((unit) => ({
          ...unit,
          payments: {
            captures: [
              {
                id: `PAYPAL-CAPTURE-${captureSequence++}`,
                status: 'COMPLETED',
              },
            ],
          },
        })),
      }
      orders.set(order.id, completed)
      sendJson(201, completed)
      return
    }

    const orderMatch = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)$/)
    if (request.method === 'GET' && orderMatch) {
      const order = orders.get(orderMatch[1])
      if (!order) {
        sendJson(404, { message: 'Order not found.' })
        return
      }

      sendJson(200, order)
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/notifications/verify-webhook-signature') {
      sendJson(200, { verification_status: 'SUCCESS' })
      return
    }

    sendJson(404, { message: 'Not found.' })
  })

  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    stop: async () => {
      await new Promise((resolvePromise) => server.close(resolvePromise))
    },
  }
}

async function startMockCreemServer() {
  const requests = []
  let productSequence = 1
  let checkoutSequence = 1
  const products = new Set()

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const chunks = []

    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    const rawBody = Buffer.concat(chunks).toString('utf8')
    const body = rawBody && rawBody.trim().startsWith('{') ? JSON.parse(rawBody) : {}
    requests.push({
      method: request.method,
      pathname: url.pathname,
      search: url.search,
      headers: request.headers,
      body,
    })

    const sendJson = (statusCode, payload) => {
      response.statusCode = statusCode
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(payload))
    }

    if (request.method === 'POST' && url.pathname === '/v1/products') {
      const id = `CREEM-PRODUCT-${productSequence++}`
      products.add(id)
      sendJson(201, {
        id,
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/checkouts') {
      if (!products.has(String(body.product_id ?? ''))) {
        sendJson(404, {
          message: ['Product not found'],
        })
        return
      }

      const id = `CREEM-CHECKOUT-${checkoutSequence++}`
      sendJson(201, {
        id,
        checkout_url: `https://checkout.creem.test/session/${id}`,
        request_id: body.request_id,
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/v1/checkouts') {
      const id = url.searchParams.get('checkout_id') ?? 'CREEM-CHECKOUT-UNKNOWN'
      sendJson(200, {
        id,
        status: 'completed',
        request_id: 'order-from-creem',
      })
      return
    }

    sendJson(404, { message: 'Not found.' })
  })

  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    stop: async () => {
      await new Promise((resolvePromise) => server.close(resolvePromise))
    },
  }
}

function createCreemRedirectSignature(apiKey, params) {
  const sortedParams = Object.keys(params)
    .filter((key) => key !== 'signature')
    .filter((key) => params[key] !== null && params[key] !== undefined && params[key] !== '' && params[key] !== 'null')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return createHmac('sha256', apiKey).update(sortedParams).digest('hex')
}

function onceExit(child) {
  return new Promise((resolvePromise) => {
    child.once('exit', resolvePromise)
    child.once('close', resolvePromise)
  })
}

test('首个注册用户不会自动成为管理员，只有白名单邮箱会注册为管理员', async () => {
  const tempDir = createTempDirectory('multica-admin-whitelist-')
  const configPath = join(tempDir, 'multica.config.json')
  const port = 5601
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
    },
  })

  const server = await startServer({
    port,
    configPath,
    env: {
      ADMIN_ALLOWED_EMAILS: 'li3169086779@outlook.com',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const firstUser = await registerUser(baseUrl, {
      name: 'Operator User',
      email: 'operator@example.com',
      password: 'VerySecure1234',
    })
    assert.equal(firstUser.payload.user.role, 'operator')

    const adminUser = await registerUser(baseUrl, {
      name: 'Configured Admin',
      email: 'li3169086779@outlook.com',
      password: 'VerySecure1234',
    })
    assert.equal(adminUser.payload.user.role, 'admin')
  } finally {
    await server.stop()
  }
})

test('白名单移除后，管理员账号下次登录会自动降回 operator', async () => {
  const tempDir = createTempDirectory('multica-admin-downgrade-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 56015
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
    },
  })

  const firstServer = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      ADMIN_ALLOWED_EMAILS: 'li3169086779@outlook.com',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const adminUser = await registerUser(baseUrl, {
      name: 'Configured Admin',
      email: 'li3169086779@outlook.com',
      password: 'VerySecure1234',
    })
    assert.equal(adminUser.payload.user.role, 'admin')
  } finally {
    await firstServer.stop()
  }

  const secondServer = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      ADMIN_ALLOWED_EMAILS: '',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const loginResult = await loginUser(baseUrl, {
      email: 'li3169086779@outlook.com',
      password: 'VerySecure1234',
    })

    assert.equal(loginResult.payload.user.role, 'operator')
  } finally {
    await secondServer.stop()
  }
})

test('管理员可以删除任意用户名下的 GenericAgent 工作区，operator 仍无权执行管理员删除', async () => {
  const tempDir = createTempDirectory('multica-admin-delete-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5602
  const creemApiKey = 'mock-creem-test-key'
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const creem = await startMockCreemServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      APP_ORIGIN: `http://localhost:${port}`,
      PAYMENT_PROVIDER: 'creem',
      CREEM_ENV: 'test',
      API_TEST_KEY: creemApiKey,
      CREEM_BASE_URL: creem.baseUrl,
      ADMIN_ALLOWED_EMAILS: 'li3169086779@outlook.com',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const admin = await registerUser(baseUrl, {
      name: 'Configured Admin',
      email: 'li3169086779@outlook.com',
      password: 'VerySecure1234',
    })
    const operator = await registerUser(baseUrl, {
      name: 'Regular User',
      email: 'operator@example.com',
      password: 'VerySecure1234',
    })

    const adminOrder = await createPaidAndDeployedOrder({
      baseUrl,
      cookie: admin.cookie,
      communicationToken: 'telegram-admin-delete-owner',
      creemApiKey,
    })
    const operatorOrder = await createPaidAndDeployedOrder({
      baseUrl,
      cookie: operator.cookie,
      communicationToken: 'telegram-admin-delete-other',
      creemApiKey,
    })

    const adminConsoleData = await fetchJson(`${baseUrl}/api/console-data`, {
      headers: {
        Cookie: admin.cookie,
      },
    })
    const adminOwnedOrder = adminConsoleData.orders.find((order) => order.id === adminOrder.id)
    const otherOrder = adminConsoleData.orders.find((order) => order.id === operatorOrder.id)

    assert.equal(adminOwnedOrder?.canAdminDeleteMultica, true)
    assert.equal(otherOrder?.canAdminDeleteMultica, true)

    const operatorConsoleData = await fetchJson(`${baseUrl}/api/console-data`, {
      headers: {
        Cookie: operator.cookie,
      },
    })

    assert.equal(operatorConsoleData.orders.length, 1)
    assert.equal(operatorConsoleData.orders[0].id, operatorOrder.id)
    assert.equal(operatorConsoleData.orders[0].canAdminDeleteMultica, false)

    const otherDeleteResponse = await fetch(`${baseUrl}/api/admin/orders/${operatorOrder.id}/multica-delete`, {
      method: 'POST',
      headers: {
        Cookie: admin.cookie,
      },
    })
    const otherDeletePayload = JSON.parse(await otherDeleteResponse.text())
    assert.equal(otherDeleteResponse.status, 200)
    assert.equal(otherDeletePayload.message, 'GenericAgent workspace deleted successfully.')
    assert.equal(otherDeletePayload.order.instance, null)
    assert.equal(otherDeletePayload.order.canAdminDeleteMultica, false)

    const operatorDeleteResponse = await fetch(`${baseUrl}/api/admin/orders/${adminOrder.id}/multica-delete`, {
      method: 'POST',
      headers: {
        Cookie: operator.cookie,
      },
    })
    const operatorDeletePayload = JSON.parse(await operatorDeleteResponse.text())
    assert.equal(operatorDeleteResponse.status, 403)
    assert.match(operatorDeletePayload.message, /admin access required/i)

    const deleteOwnResponse = await fetchJson(`${baseUrl}/api/admin/orders/${adminOrder.id}/multica-delete`, {
      method: 'POST',
      headers: {
        Cookie: admin.cookie,
      },
    })

    assert.equal(deleteOwnResponse.message, 'GenericAgent workspace deleted successfully.')
    assert.equal(deleteOwnResponse.order.instance, null)
    assert.equal(deleteOwnResponse.order.canAdminDeleteMultica, false)
  } finally {
    await server.stop()
    await creem.stop()
  }
})

test('生产模式下白名单登录用户新订单金额为 1 美元，普通用户保持套餐价', async () => {
  const tempDir = createTempDirectory('multica-admin-pricing-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5603
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
    },
  })

  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      MULTICA_ENV_PATH: 'virtual/.env.production',
      ADMIN_ALLOWED_EMAILS: 'admin@example.com',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const admin = await registerUser(baseUrl, {
      name: 'Configured Admin',
      email: 'admin@example.com',
      password: 'VerySecure1234',
    })
    const operator = await registerUser(baseUrl, {
      name: 'Regular User',
      email: 'operator@example.com',
      password: 'VerySecure1234',
    })

    const adminLaunch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-admin-pricing-token',
      }),
    })

    assert.equal(adminLaunch.order.amountCents, 100)
    assert.equal(adminLaunch.order.amountLabel, '$1')

    const operatorLaunch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: operator.cookie,
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-operator-pricing-token',
      }),
    })

    assert.equal(operatorLaunch.order.amountCents, 900)
    assert.equal(operatorLaunch.order.amountLabel, '$9')
  } finally {
    await server.stop()
  }
})

test('生产模式下白名单登录用户的 Creem 结账按订单实际金额创建商品', async () => {
  const tempDir = createTempDirectory('multica-admin-creem-pricing-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5604
  const creem = await startMockCreemServer()
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      APP_ORIGIN: `http://localhost:${port}`,
      PAYMENT_PROVIDER: 'creem',
      CREEM_ENV: 'test',
      API_TEST_KEY: 'mock-creem-test-key',
      CREEM_BASE_URL: creem.baseUrl,
      MULTICA_ENV_PATH: 'virtual/.env.production',
      ADMIN_ALLOWED_EMAILS: 'admin@example.com',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const admin = await registerUser(baseUrl, {
      name: 'Configured Admin',
      email: 'admin@example.com',
      password: 'VerySecure1234',
    })

    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-admin-creem-pricing-token',
      }),
    })

    assert.equal(launch.order.amountCents, 100)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        Cookie: admin.cookie,
      },
    })

    const productRequest = creem.requests.find((request) => request.method === 'POST' && request.pathname === '/v1/products')
    const checkoutRequest = creem.requests.find((request) => request.method === 'POST' && request.pathname === '/v1/checkouts')

    assert.equal(checkout.order.amountCents, 100)
    assert.equal(productRequest?.body.price, 100)
    assert.match(String(productRequest?.body.description ?? ''), /\$1\b/)
    assert.equal(checkoutRequest?.body.success_url, `${baseUrl}/console?order=${launch.order.id}`)
  } finally {
    await server.stop()
    await creem.stop()
  }
})

test('生产模式下白名单登录用户的 PayPal 结账按 1 美元创建订单', async () => {
  const tempDir = createTempDirectory('multica-admin-paypal-pricing-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5605
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
    },
  })

  const payPal = await startMockPayPalServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      PAYMENT_PROVIDER: 'paypal',
      PAY_CLIENT_ID: 'paypal-client-id',
      PAY_SECRET: 'paypal-secret',
      PAYPAL_BASE_URL: payPal.baseUrl,
      PAYPAL_WEBHOOK_ID: 'paypal-webhook-id',
      MULTICA_ENV_PATH: 'virtual/.env.production',
      ADMIN_ALLOWED_EMAILS: 'admin@example.com',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const admin = await registerUser(baseUrl, {
      name: 'Configured Admin',
      email: 'admin@example.com',
      password: 'VerySecure1234',
    })

    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-admin-paypal-pricing-token',
      }),
    })

    assert.equal(launch.order.amountCents, 100)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        Cookie: admin.cookie,
      },
    })

    const orderRequest = payPal.requests.find((request) => request.method === 'POST' && request.pathname === '/v2/checkout/orders')

    assert.equal(checkout.order.amountCents, 100)
    assert.equal(orderRequest?.body.purchase_units?.[0]?.amount?.value, '1.00')
  } finally {
    await server.stop()
    await payPal.stop()
  }
})

test('部署配置文件在没有 server 段时仍可正常读取', () => {
  const tempDir = createTempDirectory('multica-config-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const previousEnvironment = {
    APP_ORIGIN: process.env.APP_ORIGIN,
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
  }
  process.env.APP_ORIGIN = 'https://www.genericagent.example.com,https://genericagent.example.com'
  process.env.MULTICA_DEPLOY_HOST = '47.251.171.158'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'config-secret',
  })

  try {
    assert.equal(config.server.host, '47.251.171.158')
    assert.equal(config.server.port, 22)
    assert.equal(config.server.username, 'root')
    assert.equal(config.server.password, 'env-password')
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('部署配置会从新的私钥路径环境变量读取 SSH 凭证', () => {
  const tempDir = createTempDirectory('multica-config-private-key-')
  const configPath = join(tempDir, 'multica.config.json')
  const privateKeyPath = join(tempDir, 'multica-test.key')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })
  writeFileSync(
    privateKeyPath,
    '-----BEGIN OPENSSH PRIVATE KEY-----\nmock-private-key\n-----END OPENSSH PRIVATE KEY-----\n',
  )

  const previousEnvironment = {
    APP_ORIGIN: process.env.APP_ORIGIN,
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
    MULTICA_AGENT_DEPLOY_PRIVATE_KEY_PATH: process.env.MULTICA_AGENT_DEPLOY_PRIVATE_KEY_PATH,
    MULTICA_DEPLOY_PRIVATE_KEY_PATH: process.env.MULTICA_DEPLOY_PRIVATE_KEY_PATH,
    MULTICA_DEPLOY_PRIVATE_KEY_PASSPHRASE: process.env.MULTICA_DEPLOY_PRIVATE_KEY_PASSPHRASE,
  }
  process.env.MULTICA_DEPLOY_HOST = '136.112.42.205'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = ''
  process.env.MULTICA_AGENT_DEPLOY_PRIVATE_KEY_PATH = privateKeyPath
  delete process.env.MULTICA_DEPLOY_PRIVATE_KEY_PATH
  process.env.MULTICA_DEPLOY_PRIVATE_KEY_PASSPHRASE = 'test-passphrase'

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'config-private-key-secret',
  })

  try {
    assert.equal(config.server.host, '136.112.42.205')
    assert.equal(config.server.username, 'root')
    assert.equal(config.server.password, '')
    assert.equal(config.server.privateKeyPath, privateKeyPath)
    assert.match(config.server.privateKey, /BEGIN OPENSSH PRIVATE KEY/)
    assert.equal(config.server.privateKeyPassphrase, 'test-passphrase')
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('部署配置仍兼容旧的私钥路径环境变量名', () => {
  const tempDir = createTempDirectory('multica-config-legacy-private-key-')
  const configPath = join(tempDir, 'multica.config.json')
  const privateKeyPath = join(tempDir, 'multica-test.key')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })
  writeFileSync(
    privateKeyPath,
    '-----BEGIN OPENSSH PRIVATE KEY-----\nmock-private-key\n-----END OPENSSH PRIVATE KEY-----\n',
  )

  const previousEnvironment = {
    APP_ORIGIN: process.env.APP_ORIGIN,
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
    MULTICA_AGENT_DEPLOY_PRIVATE_KEY_PATH: process.env.MULTICA_AGENT_DEPLOY_PRIVATE_KEY_PATH,
    MULTICA_DEPLOY_PRIVATE_KEY_PATH: process.env.MULTICA_DEPLOY_PRIVATE_KEY_PATH,
    MULTICA_DEPLOY_PRIVATE_KEY_PASSPHRASE: process.env.MULTICA_DEPLOY_PRIVATE_KEY_PASSPHRASE,
  }
  process.env.MULTICA_DEPLOY_HOST = '136.112.42.205'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = ''
  delete process.env.MULTICA_AGENT_DEPLOY_PRIVATE_KEY_PATH
  process.env.MULTICA_DEPLOY_PRIVATE_KEY_PATH = privateKeyPath
  process.env.MULTICA_DEPLOY_PRIVATE_KEY_PASSPHRASE = 'legacy-test-passphrase'

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'config-private-key-secret',
  })

  try {
    assert.equal(config.server.host, '136.112.42.205')
    assert.equal(config.server.username, 'root')
    assert.equal(config.server.password, '')
    assert.equal(config.server.privateKeyPath, privateKeyPath)
    assert.match(config.server.privateKey, /BEGIN OPENSSH PRIVATE KEY/)
    assert.equal(config.server.privateKeyPassphrase, 'legacy-test-passphrase')
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('读取运行时版本时不依赖 server 段', () => {
  const tempDir = createTempDirectory('multica-config-version-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
    multica: {
      repoRef: 'release-2026-03',
    },
  })

  assert.equal(readConfiguredMulticaRepoRef(configPath), 'release-2026-03')
})

test('带有额外引号的运行时仓库配置会被规范化，避免克隆空仓库地址', () => {
  const tempDir = createTempDirectory('multica-config-repo-url-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    multica: {
      repoUrl: '""',
      repoRef: '"release-2026-03"',
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'quoted-repo-secret',
  })

  assert.equal(config.multica.repoUrl, 'https://github.com/multica/multica.git')
  assert.equal(config.multica.repoRef, 'release-2026-03')

  const persistedConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  assert.equal(persistedConfig.multica.repoUrl, 'https://github.com/multica/multica.git')
  assert.equal(persistedConfig.multica.repoRef, 'release-2026-03')
})

test('生产部署示例配置包含有效的 GenericAgent 品牌默认值', () => {
  const exampleConfigPath = resolve(projectRoot, 'multica.config.example.json')
  const config = loadDeploymentConfig({
    configPath: exampleConfigPath,
    encryptionSecret: 'example-config-secret',
  })

  assert.equal(config.provider, 'ssh')
  assert.equal(config.multica.sourceType, 'archive')
  assert.equal(config.multica.archivePath, '/data/multica/templates/multica-template.tar.gz')
  assert.equal(config.multica.repoUrl, 'https://github.com/multica/multica.git')
  assert.equal(config.multica.repoRef, 'main')
  assert.equal(config.deployment.targetServer, 'genericagent-runtime-1')
  assert.equal(config.deployment.consoleBaseUrl, 'https://console.genericagent.local')
  assert.equal(config.deployment.publicBaseUrl, 'https://genericagent.local')
  assert.equal(config.deployment.consolePortBase, 58000)
  assert.equal(config.deployment.consolePortRange, 4000)
  assert.equal(config.multica.baseDir, '/data/multica')
})

test('首次生成的部署配置默认进入 archive 模式并写入固定模板路径', () => {
  const tempDir = createTempDirectory('multica-default-config-')
  const configPath = join(tempDir, 'multica.config.json')

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'default-config-secret',
  })

  assert.equal(config.provider, 'mock')
  assert.equal(config.multica.sourceType, 'archive')
  assert.equal(config.multica.archivePath, '/data/multica/templates/multica-template.tar.gz')
  assert.equal(config.deployment.consolePortBase, 58000)
  assert.equal(config.deployment.consolePortRange, 4000)
  assert.equal(config.multica.baseDir, '/data/multica')

  const persistedConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  assert.equal(persistedConfig.multica.sourceType, 'archive')
  assert.equal(persistedConfig.multica.archivePath, '/data/multica/templates/multica-template.tar.gz')
  assert.equal(persistedConfig.deployment.consolePortBase, 58000)
  assert.equal(persistedConfig.deployment.consolePortRange, 4000)
})

test('部署配置支持从环境变量覆盖实例 console 端口范围', () => {
  const tempDir = createTempDirectory('multica-console-port-config-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
      consolePortBase: 18000,
      consolePortRange: 20000,
    },
  })

  const previousEnvironment = {
    MULTICA_CONSOLE_PORT_BASE: process.env.MULTICA_CONSOLE_PORT_BASE,
    MULTICA_CONSOLE_PORT_RANGE: process.env.MULTICA_CONSOLE_PORT_RANGE,
  }
  process.env.MULTICA_CONSOLE_PORT_BASE = '58000'
  process.env.MULTICA_CONSOLE_PORT_RANGE = '4000'

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'console-port-secret',
    })

    assert.equal(config.deployment.consolePortBase, 58000)
    assert.equal(config.deployment.consolePortRange, 4000)
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('默认部署命令使用适合构建的 npm 配置', () => {
  const tempDir = createTempDirectory('multica-default-commands-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    multica: {
      installCommand: undefined,
      buildCommand: undefined,
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'default-command-secret',
  })

  assert.equal(config.multica.installCommand, 'npm install --no-audit --no-fund')
  assert.equal(config.multica.buildCommand, 'npm run build')
  assert.equal(config.multica.startCommand, 'npm run start')
})

test('压缩包部署配置会读取 archiveUrl 并切换为 archive 模式', () => {
  const tempDir = createTempDirectory('multica-archive-config-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    multica: {
      sourceType: 'archive',
      archiveUrl: 'https://downloads.example.test/multica.tar.gz',
      installCommand: '',
      buildCommand: '',
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'archive-config-secret',
  })

  assert.equal(config.multica.sourceType, 'archive')
  assert.equal(config.multica.archiveUrl, 'https://downloads.example.test/multica.tar.gz')
  assert.equal(config.multica.archivePath, '')
  assert.equal(config.multica.installCommand, '')
  assert.equal(config.multica.buildCommand, '')
})

test('压缩包部署配置支持直接引用服务器上的预上传压缩包路径', () => {
  const tempDir = createTempDirectory('multica-archive-path-config-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    multica: {
      sourceType: 'archive',
      archivePath: '/data/multica/templates/multica-template.tar.gz',
      archiveUrl: '',
      installCommand: '',
      buildCommand: '',
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'archive-path-config-secret',
  })

  assert.equal(config.multica.sourceType, 'archive')
  assert.equal(config.multica.archivePath, '/data/multica/templates/multica-template.tar.gz')
  assert.equal(config.multica.archiveUrl, '')
})

test('远端打包脚本会从展示文案中提取真实实例名', () => {
  assert.equal(
    normalizeInstanceQuery('multica-guest-gpt-5-4-telegram-c8894e · 999999'),
    'multica-guest-gpt-5-4-telegram-c8894e',
  )
})

test('远端打包会优先复用当前 archivePath 并锁定实例 app 目录', () => {
  const tempDir = createTempDirectory('multica-package-target-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
      targetServer: '47.251.171.158',
    },
    multica: {
      sourceType: 'archive',
      archivePath: '/data/multica/templates/multica-template.tar.gz',
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'remote-package-secret',
  })
  const targetRow = {
    instance_name: 'multica-guest-gpt-5-4-telegram-c8894e',
    target_server: '47.251.171.158',
    workspace_path: '/srv/multica/instances/multica-guest-gpt-5-4-telegram-c8894e',
    runtime_user: 'mca_multica-guest-gpt-5',
    service_name: 'multica-multica-guest-gpt-5-4-telegra',
    updated_at: '2026-04-01T13:48:42.068Z',
    order_number: 'mca-123456',
  }
  const database = {
    prepare() {
      return {
        async get(instanceName, orderNumber, partialName) {
          const normalizedPartial = String(partialName ?? '').replace(/%/g, '')
          if (
            instanceName === targetRow.instance_name ||
            orderNumber === targetRow.order_number ||
            targetRow.instance_name.includes(normalizedPartial)
          ) {
            return targetRow
          }

          return undefined
        },
      }
    },
  }

  {

    return findRemotePackageTarget({
      database,
      query: 'multica-guest-gpt-5-4-telegram-c8894e · 999999',
    }).then((target) => {
    const request = resolveRemotePackageRequest({
      deploymentConfig: {
        ...config,
        server: {
          ...config.server,
          host: '127.0.0.1',
          password: 'root-password',
        },
      },
      instance: target,
    })
    const script = renderRemotePackageScript(request)

    assert.equal(request.sshHost, '47.251.171.158')
    assert.equal(request.archivePath, '/data/multica/templates/multica-template.tar.gz')
    assert.equal(request.appPath, '/srv/multica/instances/multica-guest-gpt-5-4-telegram-c8894e/app')
    assert.match(script, /tar\s+--exclude='\.git'/)
    assert.match(script, /--exclude='\.multica'/)
    assert.match(script, /--exclude='\.cache'/)
    assert.doesNotMatch(script, /sqlite/)
    assert.match(script, /--exclude='conversations'/)
    assert.match(script, /-C "\$APP_PATH" -czf "\$TMP_ARCHIVE" \./)
    assert.match(script, /ARCHIVE_PATH='\/data\/multica\/templates\/multica-template\.tar\.gz'/)
    })
  }
})

test('共享目录中的套餐与渠道目录会通过 API 暴露给前端', async () => {
  const tempDir = createTempDirectory('multica-catalog-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5615
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const payload = await fetchJson(`http://localhost:${port}/api/catalog`)

    assert.deepEqual(
      payload.plans.map((plan) => plan.id),
      planCatalog.map((plan) => plan.id),
    )
    assert.deepEqual(
      payload.models.map((model) => model.id),
      modelCatalog.map((model) => model.id),
    )
    assert.deepEqual(
      payload.channels.map((channel) => channel.id),
      channelCatalog.map((channel) => channel.id),
    )
  } finally {
    await server.stop()
  }
})

test('配置密钥不匹配时仍可创建订单并打开 PayPal 结账', async () => {
  const tempDir = createTempDirectory('multica-config-mismatch-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5620
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const payPal = await startMockPayPalServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      MULTICA_CONFIG_SECRET: 'different-config-secret',
      MULTICA_DEPLOY_HOST: '47.251.171.158',
      MULTICA_DEPLOY_PORT: '22',
      MULTICA_DEPLOY_USERNAME: 'root',
      MULTICA_DEPLOY_ROOT_PASSWORD: 'env-password',
      PAYMENT_PROVIDER: 'paypal',
      PAY_CLIENT_ID: 'paypal-client-id',
      PAY_SECRET: 'paypal-secret',
      PAYPAL_BASE_URL: payPal.baseUrl,
      PAYPAL_WEBHOOK_ID: 'paypal-webhook-id',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-mismatch-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)
    assert.equal(launch.order.multicaVersion, 'main')

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(checkout.paypalClientId, 'paypal-client-id')
    assert.match(checkout.paypalOrderId, /^PAYPAL-ORDER-/)
    assert.equal(checkout.checkoutUrl, `https://www.sandbox.paypal.com/checkoutnow?token=${checkout.paypalOrderId}`)
  } finally {
    await server.stop()
    await payPal.stop()
  }
})

test('Creem 结账会创建托管支付链接且不向前端返回支付密钥', async () => {
  const tempDir = createTempDirectory('multica-creem-checkout-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5626
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const creem = await startMockCreemServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      APP_ORIGIN: `http://localhost:${port}`,
      PAYMENT_PROVIDER: 'creem',
      CREEM_ENV: 'test',
      API_TEST_KEY: 'mock-creem-test-key',
      CREEM_BASE_URL: creem.baseUrl,
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'claude-opus-4-6',
        channelId: 'telegram',
        communicationToken: 'telegram-creem-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(checkout.paymentProvider, 'creem')
    assert.equal(checkout.creemCheckoutId, 'CREEM-CHECKOUT-1')
    assert.equal(checkout.checkoutUrl, 'https://checkout.creem.test/session/CREEM-CHECKOUT-1')
    assert.equal(checkout.paypalOrderId, null)
    assert.equal(checkout.paypalClientId, null)
    assert.equal(launch.order.amountCents, 450)
    assert.equal(launch.order.amountLabel, '$4.50')
    assert.equal(checkout.order.amountCents, 450)
    assert.equal(checkout.order.amountLabel, '$4.50')
    assert.equal(Object.values(checkout).some((value) => String(value).includes('mock-creem-test-key')), false)

    const productRequest = creem.requests.find((request) => request.method === 'POST' && request.pathname === '/v1/products')
    const checkoutRequest = creem.requests.find((request) => request.method === 'POST' && request.pathname === '/v1/checkouts')
    assert.equal(productRequest?.headers['x-api-key'], 'mock-creem-test-key')
    assert.equal(productRequest?.body.price, 450)
    assert.equal(productRequest?.body.currency, 'USD')
    assert.equal(checkoutRequest?.headers['x-api-key'], 'mock-creem-test-key')
    assert.equal(checkoutRequest?.body.request_id, launch.order.id)
    assert.equal(checkoutRequest?.body.success_url, `${baseUrl}/console?order=${launch.order.id}&guest_token=${guestToken}`)
  } finally {
    await server.stop()
    await creem.stop()
  }
})

test('Creem 结账在缓存的 product id 失效后会自动重建商品并重试', async () => {
  const tempDir = createTempDirectory('multica-creem-stale-product-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5627
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const creem = await startMockCreemServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      APP_ORIGIN: `http://localhost:${port}`,
      PAYMENT_PROVIDER: 'creem',
      CREEM_ENV: 'test',
      API_TEST_KEY: 'mock-creem-test-key',
      CREEM_BASE_URL: creem.baseUrl,
    },
  })

  try {
    const pool = server.createPool()
    const timestamp = new Date().toISOString()
    await pool.query(
      `INSERT INTO creem_products (lookup_key, product_id, amount_cents, currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['test:starter:monthly:gpt-5-4:900:USD', 'CREEM-PRODUCT-STALE', 900, 'USD', timestamp, timestamp],
    )
    await pool.end()

    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-creem-stale-product-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const checkoutRequests = creem.requests.filter((request) => request.method === 'POST' && request.pathname === '/v1/checkouts')
    const productRequests = creem.requests.filter((request) => request.method === 'POST' && request.pathname === '/v1/products')

    assert.equal(checkout.paymentProvider, 'creem')
    assert.equal(checkout.creemCheckoutId, 'CREEM-CHECKOUT-1')
    assert.equal(checkout.checkoutUrl, 'https://checkout.creem.test/session/CREEM-CHECKOUT-1')
    assert.equal(productRequests.length, 1)
    assert.equal(checkoutRequests.length, 2)
    assert.equal(checkoutRequests[0]?.body.product_id, 'CREEM-PRODUCT-STALE')
    assert.equal(checkoutRequests[1]?.body.product_id, 'CREEM-PRODUCT-1')
  } finally {
    await server.stop()
    await creem.stop()
  }
})

test('Creem 支付回跳会忽略本地订单参数并继续触发部署', async () => {
  const tempDir = createTempDirectory('multica-creem-confirm-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5631
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const creem = await startMockCreemServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      APP_ORIGIN: `http://localhost:${port}`,
      PAYMENT_PROVIDER: 'creem',
      CREEM_ENV: 'test',
      API_TEST_KEY: 'mock-creem-test-key',
      CREEM_BASE_URL: creem.baseUrl,
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-creem-confirm-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const creemRedirectParams = {
      checkout_id: checkout.creemCheckoutId,
      product_id: 'CREEM-PRODUCT-1',
      request_id: launch.order.id,
    }
    const signature = createCreemRedirectSignature('mock-creem-test-key', creemRedirectParams)

    const confirmation = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/creem-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        redirectParams: {
          order: launch.order.id,
          guest_token: guestToken,
          ...creemRedirectParams,
          signature,
        },
      }),
    })

    assert.equal(confirmation.order.paymentStatus, 'paid')

    const deployedOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    assert.equal(deployedOrder.paymentStatus, 'paid')
    assert.equal(deployedOrder.deployments.length, 1)
  } finally {
    await server.stop()
    await creem.stop()
  }
})

test('manual 模式下 Creem 支付确认后只入队，不自动触发部署', async () => {
  const tempDir = createTempDirectory('multica-creem-manual-queue-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5632
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const creem = await startMockCreemServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      APP_ORIGIN: `http://localhost:${port}`,
      PAYMENT_PROVIDER: 'creem',
      CREEM_ENV: 'test',
      API_TEST_KEY: 'mock-creem-test-key',
      CREEM_BASE_URL: creem.baseUrl,
      MULTICA_DEPLOYMENT_MODE: 'manual',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-creem-manual-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const creemRedirectParams = {
      checkout_id: checkout.creemCheckoutId,
      product_id: 'CREEM-PRODUCT-1',
      request_id: launch.order.id,
    }
    const signature = createCreemRedirectSignature('mock-creem-test-key', creemRedirectParams)

    const confirmation = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/creem-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        redirectParams: {
          order: launch.order.id,
          guest_token: guestToken,
          ...creemRedirectParams,
          signature,
        },
      }),
    })

    assert.equal(confirmation.message, 'Creem payment confirmed. Your Multica is in the provisioning queue.')
    assert.equal(confirmation.order.paymentStatus, 'paid')
    assert.equal(confirmation.order.deploymentStatus, 'queued')
    assert.equal(confirmation.order.deployment?.triggerMode, 'manual')
    assert.equal(confirmation.order.deployment?.status, 'queued')
    assert.equal(confirmation.order.instance, null)
  } finally {
    await server.stop()
    await creem.stop()
  }
})

test('console websocket session stays pinned to the selected deployment when one order has multiple instances', async () => {
  let lastUpgradeUrl = ''
  const upstream = createServer((request, response) => {
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Session pinned console</title></head><body>ok</body></html>')
  })

  upstream.on('upgrade', (request, socket) => {
    lastUpgradeUrl = request.url ?? ''
    socket.on('error', () => {})

    const acceptKey = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n'),
    )
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy()
      }
    }, 50)
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`

  const tempDir = createTempDirectory('multica-console-session-pinned-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5634
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'growth:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const firstOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const firstDeploymentId = firstOrder.deployment.id

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/deployments`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const multiDeploymentOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' && payload.order.deployments.length >= 2 ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const latestDeploymentId = multiDeploymentOrder.deployment.id
    assert.notEqual(latestDeploymentId, firstDeploymentId)

    const firstDeploymentConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        deploymentId: firstDeploymentId,
      }),
    })

    const firstConsoleUrl = new URL(firstDeploymentConsole.url, baseUrl)
    const proxiedResponse = await fetch(firstConsoleUrl, {
      headers: {
        Accept: 'text/html',
        'x-multica-guest-token': guestToken,
      },
    })
    assert.equal(proxiedResponse.status, 200)

    const setCookieHeaders = proxiedResponse.headers.getSetCookie?.() ?? []
    assert.ok(setCookieHeaders.some((value) => value.startsWith('mca_console_session=')))

    const cookieHeader = [
      `mca_guest=${encodeURIComponent(guestToken)}`,
      ...setCookieHeaders.map((value) => value.split(';', 1)[0]),
    ].join('; ')

    const upgradeStatusCode = await performWebSocketUpgrade({
      port,
      path: '/multica-console/session/237e320e10fbf53173c363588d434eb0/chat?session=main',
      headers: {
        Cookie: cookieHeader,
      },
    })

    assert.equal(upgradeStatusCode, 101)
    assert.match(lastUpgradeUrl, /\/chat\?/)
    assert.match(lastUpgradeUrl, new RegExp(`deployment=${firstDeploymentId}`))
    assert.doesNotMatch(lastUpgradeUrl, new RegExp(`deployment=${latestDeploymentId}`))
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('控制台 websocket 会绑定当前控制台上下文，而不是回退到 guest 最新订单', async () => {
  let lastUpgradeUrl = ''
  const upstream = createServer((request, response) => {
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Console context</title></head><body>ok</body></html>')
  })

  upstream.on('upgrade', (request, socket) => {
    lastUpgradeUrl = request.url ?? ''
    socket.on('error', () => {})

    const acceptKey = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n'),
    )
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy()
      }
    }, 50)
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`

  const tempDir = createTempDirectory('multica-console-context-cookie-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5632
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const firstLaunch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(firstLaunch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${firstLaunch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const firstOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${firstLaunch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const secondLaunch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        planId: 'growth:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    await fetchJson(`${baseUrl}/api/orders/${secondLaunch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const secondOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${secondLaunch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${firstLaunch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const rootConsoleUrl = new URL(tokenizedConsole.url, baseUrl)
    const proxiedResponse = await fetch(rootConsoleUrl, {
      headers: {
        Accept: 'text/html',
        'x-multica-guest-token': guestToken,
      },
    })
    assert.equal(proxiedResponse.status, 200)

    const setCookieHeaders = proxiedResponse.headers.getSetCookie?.() ?? []
    assert.ok(setCookieHeaders.some((value) => value.startsWith('mca_console_session=')))

    const cookieHeader = [
      `mca_guest=${encodeURIComponent(guestToken)}`,
      ...setCookieHeaders.map((value) => value.split(';', 1)[0]),
    ].join('; ')

    const upgradeStatusCode = await performWebSocketUpgrade({
      port,
      path: '/multica-console/session/237e320e10fbf53173c363588d434eb0',
      headers: {
        Cookie: cookieHeader,
      },
    })

    assert.equal(upgradeStatusCode, 101)
    assert.match(lastUpgradeUrl, new RegExp(`deployment=${firstOrder.deployment.id}`))
    assert.doesNotMatch(lastUpgradeUrl, new RegExp(`deployment=${secondOrder.deployment.id}`))
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('同一订单下的新实例会拿到唯一的运行用户、服务名和控制台端口', () => {
  const tempDir = createTempDirectory('multica-plan-unique-runtime-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const previousEnvironment = {
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
  }
  process.env.APP_ORIGIN = 'https://www.genericagent.example.com,https://genericagent.example.com'
  process.env.MULTICA_DEPLOY_HOST = '47.251.171.158'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'unique-runtime-secret',
    })

    const firstPreview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-unique-a',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'same-order-id',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })
    const secondPreview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-unique-b',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'same-order-id',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })

    assert.notEqual(firstPreview.plan.runtimeUser, secondPreview.plan.runtimeUser)
    assert.notEqual(firstPreview.plan.serviceName, secondPreview.plan.serviceName)
    assert.notEqual(firstPreview.plan.environment.PORT, secondPreview.plan.environment.PORT)
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('部署计划会透传额外的 Multica 运行时密钥环境变量', () => {
  const previousEnvironment = {
    QS_KEY: process.env.QS_KEY,
    MULTICA_RUNTIME_ENV_PASSTHROUGH: process.env.MULTICA_RUNTIME_ENV_PASSTHROUGH,
    CUSTOM_GATEWAY_SECRET: process.env.CUSTOM_GATEWAY_SECRET,
  }

  process.env.QS_KEY = 'qs-demo-secret'
  process.env.MULTICA_RUNTIME_ENV_PASSTHROUGH = 'CUSTOM_GATEWAY_SECRET,QS_KEY'
  process.env.CUSTOM_GATEWAY_SECRET = 'custom-secret-value'

  try {
    const tempDir = createTempDirectory('multica-plan-runtime-env-')
    const configPath = join(tempDir, 'multica.config.json')
    createTestConfig(configPath)

    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'runtime-env-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-runtime-env',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-runtime-env-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'growth:monthly',
      },
    })

    assert.equal(preview.plan.environment.QS_KEY, undefined)
    assert.equal(preview.plan.environment.CUSTOM_GATEWAY_SECRET, 'custom-secret-value')
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('启用实例路由入口后，SSH 部署计划会回写固定 console URL 并生成路由文件', () => {
  const tempDir = createTempDirectory('multica-plan-router-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const previousEnvironment = {
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
    MULTICA_ROUTER_BASE_URL: process.env.MULTICA_ROUTER_BASE_URL,
    MULTICA_ROUTER_ROUTES_DIR: process.env.MULTICA_ROUTER_ROUTES_DIR,
  }
  process.env.MULTICA_DEPLOY_HOST = '34.71.182.116'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'
  process.env.MULTICA_ROUTER_BASE_URL = 'http://10.128.0.4:19280'
  process.env.MULTICA_ROUTER_ROUTES_DIR = '/data/multica/router/routes'

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'router-plan-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-router',
      communicationToken: '',
      user: { email: 'router@example.com' },
      order: {
        id: 'order-router-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })

    assert.equal(preview.plan.consoleUrl, 'http://10.128.0.4:19280/instances/demo-claw-router/')
    assert.equal(preview.plan.publicEndpoint, 'http://10.128.0.4:19280/instances/demo-claw-router/')
    assert.match(preview.script, /ROUTER_ROUTE_FILE_PATH='\/data\/multica\/router\/routes\/demo-claw-router\.json'/)
    assert.match(preview.script, /printf '%s' "\$ROUTER_ROUTE_FILE_B64" \| base64 -d > "\$ROUTER_ROUTE_FILE_PATH"/)
    assert.match(preview.script, /\[ -z "\$ROUTER_ROUTE_FILE_PATH" \]/)
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('令牌密钥不匹配时 console 页面仍可读取订单列表', async () => {
  const tempDir = createTempDirectory('multica-token-mismatch-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5621
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const firstServer = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      MULTICA_TOKEN_SECRET: 'token-secret-original',
      MULTICA_DEPLOY_HOST: '47.251.171.158',
      MULTICA_DEPLOY_PORT: '22',
      MULTICA_DEPLOY_USERNAME: 'root',
      MULTICA_DEPLOY_ROOT_PASSWORD: 'env-password',
    },
  })

  let guestToken = ''

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-console-token',
      }),
    })

    guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token') ?? ''
    assert.ok(guestToken)
  } finally {
    await firstServer.stop()
  }

  const secondServer = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      MULTICA_TOKEN_SECRET: 'token-secret-different',
      MULTICA_DEPLOY_HOST: '47.251.171.158',
      MULTICA_DEPLOY_PORT: '22',
      MULTICA_DEPLOY_USERNAME: 'root',
      MULTICA_DEPLOY_ROOT_PASSWORD: 'env-password',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const consoleData = await fetchJson(`${baseUrl}/api/console-data`, {
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(consoleData.orders.length, 1)
    assert.equal(consoleData.orders[0].tokenDisplay, 'Token unavailable')
  } finally {
    await secondServer.stop()
  }
})

test('开发模式允许删除未支付订单，生产模式不允许', async () => {
  const tempDir = createTempDirectory('multica-delete-pending-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
    },
  })

  const devPort = 5622
  const devServer = await startServer({
    port: devPort,
    configPath,
    dataDir,
    env: {
      MULTICA_ENV_PATH: 'virtual/.env.development',
    },
  })

  try {
    const devBaseUrl = `http://localhost:${devPort}`
    const launch = await fetchJson(`${devBaseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-delete-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, devBaseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const deleteResponse = await fetchJson(`${devBaseUrl}/api/orders/${launch.order.id}/delete`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(deleteResponse.message, 'Order deleted successfully.')

    const ordersAfterDelete = await fetchJson(`${devBaseUrl}/api/orders`, {
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(ordersAfterDelete.orders.length, 0)
  } finally {
    await devServer.stop()
  }

  const prodPort = 5623
  const prodServer = await startServer({
    port: prodPort,
    configPath,
    dataDir,
    env: {
      MULTICA_ENV_PATH: 'virtual/.env.production',
    },
  })

  try {
    const prodBaseUrl = `http://localhost:${prodPort}`
    const launch = await fetchJson(`${prodBaseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-prod-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, prodBaseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await assert.rejects(
      fetchJson(`${prodBaseUrl}/api/orders/${launch.order.id}/delete`, {
        method: 'POST',
        headers: {
          'x-multica-guest-token': guestToken,
        },
      }),
      /Deleting unpaid orders is only available in development mode/,
    )
  } finally {
    await prodServer.stop()
  }
})

test('部署计划会生成只允许实例目录写入的 systemd 服务', () => {
  const tempDir = createTempDirectory('multica-plan-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath)

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'plan-secret',
  })

  const preview = createDeploymentPlanPreview(config, {
    instanceName: 'demo-claw-001',
    communicationToken: 'channel-token-123',
    user: { email: 'demo@example.com' },
    order: {
      id: 'order-001',
      model_id: 'gpt-5-4',
      channel_id: 'telegram',
      plan_id: 'growth:monthly',
    },
  })

  assert.match(preview.service, /ProtectSystem=strict/)
  assert.match(preview.service, /NoNewPrivileges=true/)
  assert.match(preview.service, /ReadWritePaths=\/srv\/multica\/instances\/demo-claw-001/)
  assert.match(preview.service, /WorkingDirectory=\/srv\/multica\/instances\/demo-claw-001\/app/)
  assert.match(preview.service, /EnvironmentFile=\/srv\/multica\/instances\/demo-claw-001\/\.env/)
  assert.match(preview.service, /ExecStart=.*npm run start/)
})

test('部署计划只让 root 执行特权步骤，应用目录与配置写入由实例用户完成', () => {
  const tempDir = createTempDirectory('multica-plan-runtime-user-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath)

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'runtime-user-secret',
  })

  const preview = createDeploymentPlanPreview(config, {
    instanceName: 'demo-claw-002',
    communicationToken: 'channel-token-456',
    user: { email: 'demo@example.com' },
    order: {
      id: 'order-002',
      model_id: 'gpt-5-4',
      channel_id: 'telegram',
      plan_id: 'growth:monthly',
    },
  })

  assert.match(preview.script, /useradd --system --create-home/)
  assert.match(preview.script, /install -d -m 700 -o "\$RUNTIME_USER" -g "\$RUNTIME_USER" "\$WORKSPACE_PATH"/)
  assert.match(preview.script, /su -s \/bin\/bash "\$RUNTIME_USER" -c 'cd '\\''[^']+'\\'' && rm -rf '\\''/)
  assert.match(preview.script, /git clone --depth 1 --branch '\\''main'\\'' '\\''https:\/\/github\.com\/multica\/multica\.git'\\'' '\\''\/srv\/multica\/instances\/demo-claw-002\/app'\\''/)
  assert.match(preview.script, /printf '%s' \\"\$ENV_B64\\"/)
  assert.match(preview.script, /base64 -d > '\/srv\/multica\/instances\/demo-claw-002\/\.env'/)
  assert.match(preview.script, /install -d -m 700 -o "\$RUNTIME_USER" -g "\$RUNTIME_USER" '\/srv\/multica\/instances\/demo-claw-002\/state'/)
  assert.match(preview.script, /ACTIVE_STATE=\$\(systemctl is-active "\$SERVICE_NAME" \|\| true\)/)
  assert.match(preview.script, /GenericAgent service \$SERVICE_NAME did not become active/)
  assert.match(preview.script, /CONSOLE_READY=0/)
  assert.match(preview.script, /GenericAgent console on port \$CONSOLE_PORT did not become reachable\./)
  assert.doesNotMatch(preview.script, /npm install -g multica/)
  assert.doesNotMatch(preview.script, /\\\$REPO_URL/)
  assert.doesNotMatch(preview.script, /\\\$ENV_B64/)
  assert.doesNotMatch(preview.script, /git clone --depth 1 --branch "\$REPO_REF" "\$REPO_URL" "\$APP_PATH"/)
  assert.doesNotMatch(preview.script, /chown -R "\$RUNTIME_USER:\$RUNTIME_USER" "\$APP_PATH"/)
})

test('部署计划支持通过压缩包 URL 快速下发 GenericAgent 运行时', () => {
  const tempDir = createTempDirectory('multica-plan-archive-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    multica: {
      sourceType: 'archive',
      archiveUrl: 'https://downloads.example.test/multica.tar.gz',
      installCommand: '',
      buildCommand: '',
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'archive-plan-secret',
  })

  const preview = createDeploymentPlanPreview(config, {
    instanceName: 'demo-claw-archive',
    communicationToken: '',
    user: { email: 'archive@example.com' },
    order: {
      id: 'order-archive',
      model_id: 'gpt-5-4',
      channel_id: 'telegram',
      plan_id: 'growth:monthly',
    },
  })

  assert.match(preview.script, /downloads\.example\.test\/multica\.tar\.gz/)
  assert.match(preview.script, /curl -fsSL "\$ARCHIVE_URL" -o "\$ARCHIVE_FILE"/)
  assert.match(preview.script, /shopt -s dotglob nullglob/)
  assert.match(preview.script, /EXTRACT_ENTRIES=\("\$EXTRACT_DIR"\/\*\)/)
  assert.match(preview.script, /cp -a "\$SOURCE_DIR"\/\. .*demo-claw-archive\/app\//)
  assert.doesNotMatch(preview.script, /\| head -n 1/)
  assert.doesNotMatch(preview.script, /tar -C "\$SOURCE_DIR" -cf - \. \| tar -C .*demo-claw-archive\/app.* -xf -/)
  assert.doesNotMatch(preview.script, /git clone --depth 1 --branch 'main'/)
})

test('部署计划支持直接解压服务器上预上传的 GenericAgent 压缩包', () => {
  const tempDir = createTempDirectory('multica-plan-archive-path-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    multica: {
      sourceType: 'archive',
      archivePath: '/data/multica/templates/multica-template.tar.gz',
      archiveUrl: '',
      installCommand: '',
      buildCommand: '',
    },
  })

  const config = loadDeploymentConfig({
    configPath,
    encryptionSecret: 'archive-path-plan-secret',
  })

  const preview = createDeploymentPlanPreview(config, {
    instanceName: 'demo-claw-archive-path',
    communicationToken: '',
    user: { email: 'archive-path@example.com' },
    order: {
      id: 'order-archive-path',
      model_id: 'gpt-5-4',
      channel_id: 'telegram',
      plan_id: 'growth:monthly',
    },
  })

  assert.match(preview.script, /ARCHIVE_SOURCE_PATH='\/data\/multica\/templates\/multica-template\.tar\.gz'/)
  assert.match(preview.script, /ARCHIVE_STAGE_PATH='\/srv\/multica\/instances\/demo-claw-archive-path\/\.tmp\/multica-template\.tar\.gz'/)
  assert.match(preview.script, /install -m 600 -o "\$RUNTIME_USER" -g "\$RUNTIME_USER" "\$ARCHIVE_SOURCE_PATH" "\$ARCHIVE_STAGE_PATH"/)
  assert.match(preview.script, /ARCHIVE_FILE='\\''\/srv\/multica\/instances\/demo-claw-archive-path\/\.tmp\/multica-template\.tar\.gz'\\''/)
  assert.match(preview.script, /cp -a "\$SOURCE_DIR"\/\. .*demo-claw-archive-path\/app\//)
  assert.doesNotMatch(preview.script, /\| head -n 1/)
})

test('部署计划会在未配置实例专用数据库时回退到 Launch PostgreSQL 连接', () => {
  const tempDir = createTempDirectory('multica-plan-postgres-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath)

  const previousEnvironment = {
    MULTICA_POSTGRES_HOST: process.env.MULTICA_POSTGRES_HOST,
    MULTICA_POSTGRES_DB: process.env.MULTICA_POSTGRES_DB,
    MULTICA_POSTGRES_USER: process.env.MULTICA_POSTGRES_USER,
    MULTICA_POSTGRES_PASSWORD: process.env.MULTICA_POSTGRES_PASSWORD,
    MULTICA_POSTGRES_PORT: process.env.MULTICA_POSTGRES_PORT,
  }

  process.env.MULTICA_POSTGRES_HOST = '127.0.0.1'
  process.env.MULTICA_POSTGRES_DB = 'multica_dev'
  process.env.MULTICA_POSTGRES_USER = 'multica_dev_user'
  process.env.MULTICA_POSTGRES_PASSWORD = 'dev-db-password'
  process.env.MULTICA_POSTGRES_PORT = '5432'

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'plan-postgres-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-db',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-db-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'growth:monthly',
      },
    })

    assert.equal(preview.plan.environment.DATABASE_PROVIDER, 'postgresql')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_HOST, '127.0.0.1')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_PORT, '5432')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_DB, 'multica_dev')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_USER, 'multica_dev_user')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_PASSWORD, 'dev-db-password')
    assert.equal(
      preview.plan.environment.DATABASE_URL,
      'postgresql://multica_dev_user:dev-db-password@127.0.0.1:5432/multica_dev',
    )
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('部署计划会优先把实例专用 PostgreSQL 连接写入 GenericAgent 实例环境变量', () => {
  const tempDir = createTempDirectory('multica-plan-instance-postgres-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath)

  const previousEnvironment = {
    MULTICA_POSTGRES_HOST: process.env.MULTICA_POSTGRES_HOST,
    MULTICA_POSTGRES_DB: process.env.MULTICA_POSTGRES_DB,
    MULTICA_POSTGRES_USER: process.env.MULTICA_POSTGRES_USER,
    MULTICA_POSTGRES_PASSWORD: process.env.MULTICA_POSTGRES_PASSWORD,
    MULTICA_POSTGRES_PORT: process.env.MULTICA_POSTGRES_PORT,
    MULTICA_INSTANCE_POSTGRES_HOST: process.env.MULTICA_INSTANCE_POSTGRES_HOST,
    MULTICA_INSTANCE_POSTGRES_DB: process.env.MULTICA_INSTANCE_POSTGRES_DB,
    MULTICA_INSTANCE_POSTGRES_USER: process.env.MULTICA_INSTANCE_POSTGRES_USER,
    MULTICA_INSTANCE_POSTGRES_PASSWORD: process.env.MULTICA_INSTANCE_POSTGRES_PASSWORD,
    MULTICA_INSTANCE_POSTGRES_PORT: process.env.MULTICA_INSTANCE_POSTGRES_PORT,
    MULTICA_INSTANCE_POSTGRES_SSLMODE: process.env.MULTICA_INSTANCE_POSTGRES_SSLMODE,
  }

  process.env.MULTICA_POSTGRES_HOST = '127.0.0.1'
  process.env.MULTICA_POSTGRES_DB = 'multica_launch_prod'
  process.env.MULTICA_POSTGRES_USER = 'multica_launch_prod_user'
  process.env.MULTICA_POSTGRES_PASSWORD = 'launch-db-password'
  process.env.MULTICA_POSTGRES_PORT = '5432'
  process.env.MULTICA_INSTANCE_POSTGRES_HOST = '127.0.0.1'
  process.env.MULTICA_INSTANCE_POSTGRES_DB = 'multica_prod'
  process.env.MULTICA_INSTANCE_POSTGRES_USER = 'multica_prod_user'
  process.env.MULTICA_INSTANCE_POSTGRES_PASSWORD = 'instance-db-password'
  process.env.MULTICA_INSTANCE_POSTGRES_PORT = '5433'
  process.env.MULTICA_INSTANCE_POSTGRES_SSLMODE = 'require'

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'plan-instance-postgres-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-instance-db',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-instance-db-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'growth:monthly',
      },
    })

    assert.equal(preview.plan.environment.MULTICA_POSTGRES_HOST, '127.0.0.1')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_PORT, '5433')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_DB, 'multica_prod')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_USER, 'multica_prod_user')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_PASSWORD, 'instance-db-password')
    assert.equal(preview.plan.environment.MULTICA_POSTGRES_SSLMODE, 'require')
    assert.equal(
      preview.plan.environment.DATABASE_URL,
      'postgresql://multica_prod_user:instance-db-password@127.0.0.1:5433/multica_prod?sslmode=require',
    )
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('SSH 部署配置会优先读取 dev 或 prod 环境文件中的服务器凭据', () => {
  const tempDir = createTempDirectory('multica-config-env-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const previousEnvironment = {
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
  }

  process.env.MULTICA_DEPLOY_HOST = '47.251.171.158'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'env-server-secret',
    })

    assert.equal(config.server.host, '47.251.171.158')
    assert.equal(config.server.port, 22)
    assert.equal(config.server.username, 'root')
    assert.equal(config.server.password, 'env-password')
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('SSH 部署计划会在部署时回写真实控制台地址', () => {
  const tempDir = createTempDirectory('multica-ssh-plan-')
  const configPath = join(tempDir, 'multica.config.json')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const previousEnvironment = {
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
    MULTICA_CONSOLE_PORT_BASE: process.env.MULTICA_CONSOLE_PORT_BASE,
    MULTICA_CONSOLE_PORT_RANGE: process.env.MULTICA_CONSOLE_PORT_RANGE,
    MULTICA_ROUTER_BASE_URL: process.env.MULTICA_ROUTER_BASE_URL,
    MULTICA_ROUTER_ROUTES_DIR: process.env.MULTICA_ROUTER_ROUTES_DIR,
  }
  process.env.MULTICA_DEPLOY_HOST = '47.251.171.158'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'
  process.env.MULTICA_CONSOLE_PORT_BASE = '58000'
  process.env.MULTICA_CONSOLE_PORT_RANGE = '4000'
  delete process.env.MULTICA_ROUTER_BASE_URL
  delete process.env.MULTICA_ROUTER_ROUTES_DIR

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'ssh-plan-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-ssh',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: '6a55bf1250ae2efcae8315a85813c52c',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })

    const consoleUrl = new URL(preview.plan.consoleUrl)
    assert.equal(consoleUrl.hostname, '47.251.171.158')
    assert.equal(preview.plan.publicEndpoint, preview.plan.consoleUrl)
    assert.equal(preview.plan.environment.PORT, consoleUrl.port)
    assert.ok(Number(consoleUrl.port) >= 58000)
    assert.ok(Number(consoleUrl.port) < 62000)
    assert.ok(preview.script.includes(`CONSOLE_URL='http://47.251.171.158:${consoleUrl.port}'`))
    assert.ok(preview.script.includes(`CONSOLE_PORT='${consoleUrl.port}'`))
    assert.match(preview.script, /firewall-cmd --permanent --add-port="\$CONSOLE_PORT\/tcp"/)
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('已支付订单会自动部署，支持手动触发与版本升级', async () => {
  const tempDir = createTempDirectory('multica-e2e-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5617
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'growth:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-token-001',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const firstDeployment = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      if (payload.order.deploymentStatus === 'deployed' && payload.order.deploymentsRemaining === 4) {
        return payload.order
      }

      return null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    assert.equal(firstDeployment.deployments.length, 1)
    assert.equal(firstDeployment.multicaVersion, 'main')
    const firstDeploymentId = firstDeployment.deployment.id

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/deployments`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const secondDeployment = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      if (payload.order.deploymentStatus === 'deployed' && payload.order.deployments.length >= 2) {
        return payload.order
      }

      return null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    assert.equal(secondDeployment.deploymentsRemaining, 3)

    const consoleData = await fetchJson(`${baseUrl}/api/console-data`, {
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(consoleData.claws.length, 2)
    assert.equal(
      consoleData.claws.every((claw) => claw.workspacePath?.includes('/mock-remote/instances/')),
      true,
    )

    const latestWorkspace = consoleData.claws
      .sort((left, right) => right.sequenceNumber - left.sequenceNumber)[0]
      .workspacePath
    const envContent = readFileSync(join(latestWorkspace, '.env'), 'utf8')
    assert.doesNotMatch(envContent, /COMMUNICATION_TOKEN=/)
    assert.match(envContent, /MULTICA_CHANNEL_BOUND=true/)
    assert.match(envContent, /MULTICA_GATEWAY_TOKEN=/)

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })
    assert.match(tokenizedConsole.url, /\?deployment=.*&token=/)
    assert.match(tokenizedConsole.url, new RegExp(`guest_token=${guestToken}`))

    const firstDeploymentConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        deploymentId: firstDeploymentId,
      }),
    })
    assert.match(firstDeploymentConsole.url, new RegExp(`deployment=${firstDeploymentId}`))
    assert.notEqual(firstDeploymentConsole.url, tokenizedConsole.url)

    const upgradeResponse = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        version: 'v2.3.4',
      }),
    })

    assert.equal(upgradeResponse.order.multicaVersion, 'v2.3.4')

    const upgradedDeployment = JSON.parse(readFileSync(join(latestWorkspace, 'app', 'deployment.json'), 'utf8'))
    assert.equal(upgradedDeployment.multicaVersion, 'v2.3.4')

    const stopResponse = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-stop`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(stopResponse.order.instance.runtimeState, 'stopped')

    await assert.rejects(
      fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
        method: 'POST',
        headers: {
          'x-multica-guest-token': guestToken,
        },
      }),
      /This GenericAgent workspace is stopped/,
    )

    const uninstallResponse = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-delete`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(uninstallResponse.message, 'GenericAgent workspace deleted successfully.')
    assert.equal(uninstallResponse.order.instance.sequenceNumber, 1)
    assert.equal(uninstallResponse.order.deployments.length, 1)
    assert.equal(uninstallResponse.order.deploymentsRemaining, 4)
  } finally {
    await server.stop()
  }
})

test('无 token 也能完成部署并打开 GenericAgent 控制台', async () => {
  const tempDir = createTempDirectory('multica-no-token-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5618
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const deployedOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      if (payload.order.deploymentStatus === 'deployed' && payload.order.instance?.consoleUrl) {
        return payload.order
      }

      return null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    assert.equal(deployedOrder.tokenDisplay, 'Not bound')
    assert.equal(typeof deployedOrder.instance?.consoleUrl, 'string')

    const envContent = readFileSync(join(deployedOrder.instance.workspacePath, '.env'), 'utf8')
    assert.doesNotMatch(envContent, /COMMUNICATION_TOKEN=/)
    assert.match(envContent, /MULTICA_CHANNEL_BOUND=false/)
    assert.match(envContent, /MULTICA_GATEWAY_TOKEN=/)

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })
    assert.match(tokenizedConsole.url, /\?deployment=.*&token=/)
  } finally {
    await server.stop()
  }
})

test('控制台代理会重试瞬时不可达的新部署实例', async () => {
  let requestCount = 0
  let lastRequestUrl = ''
  const upstream = createServer((request, response) => {
    requestCount += 1
    lastRequestUrl = request.url ?? ''

    if (requestCount === 1) {
      request.socket.destroy()
      return
    }

    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Transient console ready</title></head><body>ok</body></html>')
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}/instances`

  const tempDir = createTempDirectory('multica-console-retry-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5631
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const deployedOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const proxiedResponse = await fetch(`${baseUrl}${tokenizedConsole.url}`, {
      headers: {
        Accept: 'text/html',
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(proxiedResponse.status, 200)
    assert.equal(requestCount, 2)
    assert.match(lastRequestUrl, new RegExp(`/instances/${deployedOrder.instance?.instanceName ?? deployedOrder.instance?.instance_name ?? ''}`))
    assert.match(await proxiedResponse.text(), /Transient console ready/)
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('控制台代理会重试瞬时断开的 websocket 握手', async () => {
  let upgradeCount = 0
  let lastUpgradeUrl = ''
  const upstream = createServer()

  upstream.on('upgrade', (request, socket) => {
    upgradeCount += 1
    lastUpgradeUrl = request.url ?? ''
    socket.on('error', () => {})

    if (upgradeCount === 1) {
      socket.destroy()
      return
    }

    const acceptKey = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n'),
    )
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy()
      }
    }, 50)
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}/instances`

  const tempDir = createTempDirectory('multica-console-upgrade-retry-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5632
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const deployedOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })
    const tokenizedConsoleUrl = new URL(tokenizedConsole.url, baseUrl)

    const upgradeStatusCode = await performWebSocketUpgrade({
      port,
      path: `${tokenizedConsoleUrl.pathname}${tokenizedConsoleUrl.search}`,
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(upgradeStatusCode, 101)
    assert.equal(upgradeCount, 2)
    assert.match(lastUpgradeUrl, new RegExp(`/instances/${deployedOrder.instance?.instanceName ?? deployedOrder.instance?.instance_name ?? ''}`))
    assert.match(lastUpgradeUrl, new RegExp(`deployment=${deployedOrder.deployment.id}`))
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('控制台链接会携带 guest token 并支持仅凭查询参数建立 websocket', async () => {
  let lastHttpUrl = ''
  let lastUpgradeUrl = ''
  const upstream = createServer((request, response) => {
    lastHttpUrl = request.url ?? ''
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Guest console</title></head><body>ok</body></html>')
  })

  upstream.on('upgrade', (request, socket) => {
    lastUpgradeUrl = request.url ?? ''
    socket.on('error', () => {})

    const acceptKey = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n'),
    )
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy()
      }
    }, 50)
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`

  const tempDir = createTempDirectory('multica-console-guest-query-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5635
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const rootConsoleUrl = new URL(tokenizedConsole.url, baseUrl)
    assert.equal(rootConsoleUrl.searchParams.get('guest_token'), guestToken)

    const proxiedResponse = await fetch(rootConsoleUrl, {
      headers: {
        Accept: 'text/html',
      },
    })
    assert.equal(proxiedResponse.status, 200)

    const proxiedHtml = await proxiedResponse.text()
    const evaluated = evaluateInjectedBootstrap(extractInjectedBootstrap(proxiedHtml), rootConsoleUrl.toString())
    const gatewayUrl = new URL(JSON.parse(evaluated.localStorage.getItem('multica.control.settings.v1') ?? '{}').gatewayUrl)

    assert.equal(gatewayUrl.searchParams.get('guest_token'), guestToken)
    assert.doesNotMatch(lastHttpUrl, /guest_token=/)

    const upgradeStatusCode = await performWebSocketUpgrade({
      port,
      path: `${rootConsoleUrl.pathname}${rootConsoleUrl.search}`,
    })

    assert.equal(upgradeStatusCode, 101)
    assert.doesNotMatch(lastUpgradeUrl, /guest_token=/)
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('控制台根页面在 SPA 切到聊天路由后会刷新 websocket 地址', async () => {
  const upstream = createServer((request, response) => {
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Console root</title></head><body>ok</body></html>')
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`

  const tempDir = createTempDirectory('multica-console-spa-route-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5634
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'growth:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' && payload.order.deploymentsRemaining === 4 ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/deployments`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const latestOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' && payload.order.deployments.length >= 2 ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const latestDeploymentId = latestOrder.deployment.id
    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const rootConsoleUrl = new URL(tokenizedConsole.url, baseUrl)
    const proxiedResponse = await fetch(rootConsoleUrl, {
      headers: {
        Accept: 'text/html',
        'x-multica-guest-token': guestToken,
      },
    })
    assert.equal(proxiedResponse.status, 200)

    const proxiedHtml = await proxiedResponse.text()
    const evaluated = evaluateInjectedBootstrap(extractInjectedBootstrap(proxiedHtml), rootConsoleUrl.toString())
    const initialSettings = JSON.parse(evaluated.localStorage.getItem('multica.control.settings.v1') ?? '{}')
    const initialGatewayUrl = new URL(initialSettings.gatewayUrl)

    assert.equal(initialGatewayUrl.pathname, rootConsoleUrl.pathname)

    const chatPathname = `${rootConsoleUrl.pathname.replace(/\/$/, '')}/chat`
    evaluated.window.history.pushState({ view: 'chat' }, '', `${chatPathname}?session=main`)

    const updatedSettings = JSON.parse(evaluated.localStorage.getItem('multica.control.settings.v1') ?? '{}')
    const updatedGatewayUrl = new URL(updatedSettings.gatewayUrl)

    assert.equal(updatedGatewayUrl.pathname, chatPathname)
    assert.equal(updatedGatewayUrl.searchParams.get('deployment'), latestDeploymentId)
    assert.equal(updatedGatewayUrl.searchParams.get('session'), 'main')
    assert.equal(updatedGatewayUrl.searchParams.get('guest_token'), guestToken)
    assert.equal(
      evaluated.sessionStorage.getItem(`multica.control.token.v1:ws://localhost:${port}${chatPathname}`),
      rootConsoleUrl.searchParams.get('token'),
    )

    const staleSocketUrl = new URL(initialGatewayUrl.toString())
    staleSocketUrl.pathname = '/multica-console/session/237e320e10fbf53173c363588d434eb0'
    staleSocketUrl.search = '?deployment=stale-deployment&token=stale-token&session=stale'

    new evaluated.window.WebSocket(staleSocketUrl.toString())
    assert.equal(evaluated.webSocketCalls.length, 1)

    const rewrittenSocketUrl = new URL(evaluated.webSocketCalls[0].url)
    assert.equal(rewrittenSocketUrl.pathname, chatPathname)
    assert.equal(rewrittenSocketUrl.searchParams.get('deployment'), latestDeploymentId)
    assert.equal(rewrittenSocketUrl.searchParams.get('session'), 'main')
    assert.equal(rewrittenSocketUrl.searchParams.get('guest_token'), guestToken)
    assert.equal(rewrittenSocketUrl.searchParams.get('token'), rootConsoleUrl.searchParams.get('token'))
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('控制台深链会为最新部署保留 websocket 子路径与查询参数', async () => {
  let lastHttpUrl = ''
  let lastUpgradeUrl = ''
  const upstream = createServer((request, response) => {
    lastHttpUrl = request.url ?? ''
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Chat console</title></head><body>ok</body></html>')
  })

  upstream.on('upgrade', (request, socket) => {
    lastUpgradeUrl = request.url ?? ''
    socket.on('error', () => {})

    const acceptKey = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n'),
    )
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy()
      }
    }, 50)
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`

  const tempDir = createTempDirectory('multica-console-chat-route-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5633
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'growth:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' && payload.order.deploymentsRemaining === 4 ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/deployments`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const latestOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' && payload.order.deployments.length >= 2 ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const latestDeploymentId = latestOrder.deployment.id
    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const chatConsoleUrl = new URL(tokenizedConsole.url, baseUrl)
    chatConsoleUrl.pathname = `${chatConsoleUrl.pathname.replace(/\/$/, '')}/chat`
    chatConsoleUrl.searchParams.set('session', 'main')

    const proxiedResponse = await fetch(chatConsoleUrl, {
      headers: {
        Accept: 'text/html',
        'x-multica-guest-token': guestToken,
      },
    })
    assert.equal(proxiedResponse.status, 200)

    const proxiedHtml = await proxiedResponse.text()
    const evaluated = evaluateInjectedBootstrap(extractInjectedBootstrap(proxiedHtml), chatConsoleUrl.toString())
    const storedSettings = JSON.parse(evaluated.localStorage.getItem('multica.control.settings.v1') ?? '{}')
    const gatewayUrl = new URL(storedSettings.gatewayUrl)

    assert.equal(gatewayUrl.protocol, 'ws:')
    assert.equal(gatewayUrl.pathname, chatConsoleUrl.pathname)
    assert.equal(gatewayUrl.searchParams.get('deployment'), latestDeploymentId)
    assert.equal(gatewayUrl.searchParams.get('session'), 'main')
    assert.equal(evaluated.window.__MULTICA_PROXY_TOKEN, chatConsoleUrl.searchParams.get('token'))
    assert.match(lastHttpUrl, /\/chat\?/)
    assert.match(lastHttpUrl, new RegExp(`deployment=${latestDeploymentId}`))
    assert.match(lastHttpUrl, /session=main/)

    const upgradeStatusCode = await performWebSocketUpgrade({
      port,
      path: `${chatConsoleUrl.pathname}${chatConsoleUrl.search}`,
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(upgradeStatusCode, 101)
    assert.match(lastUpgradeUrl, /\/chat\?/)
    assert.match(lastUpgradeUrl, new RegExp(`deployment=${latestDeploymentId}`))
    assert.match(lastUpgradeUrl, /session=main/)
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('部署失败但已知实例名时仍可卸载并清理 mock 目录', async () => {
  const tempDir = createTempDirectory('multica-failed-uninstall-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5630
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })
  const now = new Date().toISOString()
  const guestToken = 'guest-token-failed-uninstall'
  const orderId = 'aa11bb22cc33dd44ee55ff6677889900'
  const userId = '00112233445566778899aabbccddeeff'
  const failedInstances = [
    {
      deploymentId: 'ffeeddccbbaa99887766554433221100',
      clawId: '11223344556677889900aabbccddeeff',
      instanceName: 'failed-claw-001',
      sequenceNumber: 1,
    },
    {
      deploymentId: '0011ee22dd33cc44bb55aa6677889900',
      clawId: 'ffeeddccbbaa00112233445566778899',
      instanceName: 'failed-claw-002',
      sequenceNumber: 2,
    },
  ].map((item) => ({
    ...item,
    workspacePath: `${resolve(tempDir, 'mock-remote').replace(/\\/g, '/')}/instances/${item.instanceName}`,
    runtimeUser: `mca_${item.instanceName}`,
    serviceName: `multica-${item.instanceName}`,
  }))
  const db = server.createPool()

  try {
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, 'failed@example.com', 'Failed User', 'hash:salt', 'operator', 'active', now, now],
    )

    await db.query(
      `INSERT INTO orders (
        id, order_number, user_id, guest_token, plan_id, model_id, channel_id,
        token_cipher_text, token_iv, token_tag, amount_cents, currency,
        payment_status, deployment_status, status_message, deployment_eta_minutes,
        included_deployments, created_at, updated_at, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        orderId,
        'mca-FAILED-UNINSTALL',
        userId,
        guestToken,
        'growth:annual',
        'gpt-5-4',
        'telegram',
        'cipher',
        'iv',
        'tag',
        1000,
        'USD',
        'paid',
        'failed',
        'Deployment failed.',
        8,
        5,
        now,
        now,
        now,
      ],
    )

    for (const failedInstance of failedInstances) {
      await db.query(
        `INSERT INTO deployments (
          id, order_id, user_id, trigger_mode, sequence_number, instance_name, status,
          progress, eta_minutes, target_server, workspace_path, console_url, public_endpoint,
          runtime_user, service_name, last_message, run_logs, created_at, finished_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          failedInstance.deploymentId,
          orderId,
          userId,
          'manual',
          failedInstance.sequenceNumber,
          failedInstance.instanceName,
          'failed',
          55,
          8,
          'mock-node',
          failedInstance.workspacePath,
          null,
          null,
          failedInstance.runtimeUser,
          failedInstance.serviceName,
          'fatal: repository does not exist',
          'fatal: repository does not exist',
          now,
          now,
          now,
        ],
      )

      await db.query(
        `INSERT INTO agent_instances (
          id, order_id, deployment_id, user_id, sequence_number, instance_name,
          model_id, channel_id, status, target_server, workspace_path, runtime_user,
          service_name, runtime_state, multica_version, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          failedInstance.clawId,
          orderId,
          failedInstance.deploymentId,
          userId,
          failedInstance.sequenceNumber,
          failedInstance.instanceName,
          'gpt-5-4',
          'telegram',
          'failed',
          'mock-node',
          failedInstance.workspacePath,
          failedInstance.runtimeUser,
          failedInstance.serviceName,
          'failed',
          'main',
          now,
          now,
        ],
      )

      const mockInstanceDir = join(tempDir, 'mock-remote', 'instances', failedInstance.instanceName)
      mkdirSync(mockInstanceDir, { recursive: true })
      writeFileSync(join(mockInstanceDir, 'artifact.txt'), 'stale deployment artifact')
    }
  } finally {
    await db.end()
  }

  try {
    const response = await fetchJson(`http://localhost:${port}/api/orders/${orderId}/multica-uninstall`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(response.message, 'GenericAgent workspace uninstalled successfully.')
    assert.equal(response.order.instance, null)
    assert.equal(response.order.deploymentStatus, 'failed')
    for (const failedInstance of failedInstances) {
      assert.equal(existsSync(join(tempDir, 'mock-remote', 'instances', failedInstance.instanceName)), false)
    }

    const verifyDb = server.createPool()
    try {
      assert.equal(
        Number((await verifyDb.query('select count(*)::int as count from agent_instances where order_id = $1', [orderId])).rows[0].count),
        0,
      )
      assert.equal(
        Number((await verifyDb.query('select count(*)::int as count from deployments where order_id = $1', [orderId])).rows[0].count),
        0,
      )
    } finally {
      await verifyDb.end()
    }
  } finally {
    await server.stop()
  }
})

test('PayPal capture 成功后会把订单置为已支付并触发自动部署', async () => {
  const tempDir = createTempDirectory('multica-paypal-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5619
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const payPal = await startMockPayPalServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      PAYMENT_PROVIDER: 'paypal',
      PAY_CLIENT_ID: 'paypal-client-id',
      PAY_SECRET: 'paypal-secret',
      PAYPAL_BASE_URL: payPal.baseUrl,
      PAYPAL_WEBHOOK_ID: 'paypal-webhook-id',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-paypal-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    assert.equal(checkout.paypalClientId, 'paypal-client-id')
    assert.match(checkout.paypalOrderId, /^PAYPAL-ORDER-/)
    assert.equal(checkout.checkoutUrl, `https://www.sandbox.paypal.com/checkoutnow?token=${checkout.paypalOrderId}`)

    const capture = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/paypal-capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        paypalOrderId: checkout.paypalOrderId,
      }),
    })

    assert.equal(capture.order.paymentStatus, 'paid')

    const deployedOrder = await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      if (payload.order.deploymentStatus === 'deployed') {
        return payload.order
      }

      return null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    assert.equal(deployedOrder.paymentStatus, 'paid')
    assert.equal(deployedOrder.deployments.length, 1)
  } finally {
    await server.stop()
    await payPal.stop()
  }
})

test('控制台代理会保留浏览器原始 origin 和 referer 给上游实例', async () => {
  let lastHttpOrigin = ''
  let lastHttpReferer = ''
  let lastUpgradeOrigin = ''
  const upstream = createServer((request, response) => {
    lastHttpOrigin = String(request.headers.origin ?? '')
    lastHttpReferer = String(request.headers.referer ?? '')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Origin passthrough console</title></head><body>ok</body></html>')
  })

  upstream.on('upgrade', (request, socket) => {
    lastUpgradeOrigin = String(request.headers.origin ?? '')
    socket.on('error', () => {})

    const acceptKey = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64')

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        '',
      ].join('\r\n'),
    )
    setTimeout(() => {
      if (!socket.destroyed) {
        socket.destroy()
      }
    }, 50)
  })

  await new Promise((resolvePromise) => upstream.listen(0, '127.0.0.1', resolvePromise))
  const upstreamPort = upstream.address().port
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamPort}`

  const tempDir = createTempDirectory('multica-console-origin-passthrough-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5632
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      consoleBaseUrl: upstreamBaseUrl,
      publicBaseUrl: upstreamBaseUrl,
      mockRootDir: './mock-remote',
    },
  })

  const server = await startServer({ port, configPath, dataDir })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'growth:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: '',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/pay`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    await waitUntil(async () => {
      const payload = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}`, {
        headers: {
          'x-multica-guest-token': guestToken,
        },
      })

      return payload.order.deploymentStatus === 'deployed' ? payload.order : null
    }, {
      timeoutMs: 20000,
      intervalMs: 300,
    })

    const tokenizedConsole = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/multica-console`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    const rootConsoleUrl = new URL(tokenizedConsole.url, baseUrl)
    const browserOrigin = 'https://www.genericagent.example.com'
    const browserReferer = 'https://www.genericagent.example.com/console'

    const proxiedResponse = await fetch(rootConsoleUrl, {
      headers: {
        Accept: 'text/html',
        Origin: browserOrigin,
        Referer: browserReferer,
      },
    })
    assert.equal(proxiedResponse.status, 200)
    await proxiedResponse.text()

    const upgradeStatusCode = await performWebSocketUpgrade({
      port,
      path: `${rootConsoleUrl.pathname}${rootConsoleUrl.search}`,
      headers: {
        Origin: browserOrigin,
      },
    })

    assert.equal(upgradeStatusCode, 101)
    assert.equal(lastHttpOrigin, browserOrigin)
    assert.equal(lastHttpReferer, browserReferer)
    assert.equal(lastUpgradeOrigin, browserOrigin)
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => upstream.close(resolvePromise))
  }
})

test('SSH 部署模板会继承本机 Multica 模型配置，并把 auth profiles 同步到 state 目录', () => {
  const tempDir = createTempDirectory('multica-local-template-')
  const configPath = join(tempDir, 'multica.config.json')
  const fakeHome = join(tempDir, 'fake-home')
  const localMulticaDir = join(fakeHome, '.multica')
  const localAgentDir = join(localMulticaDir, 'agents', 'main', 'agent')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  mkdirSync(localAgentDir, { recursive: true })
  writeFileSync(
    join(localMulticaDir, 'multica.json'),
    JSON.stringify(
      {
        models: {
          mode: 'merge',
          providers: {
            'api-proxy-gpt': {
              baseUrl: 'https://example-proxy.test/v1',
              api: 'openai-completions',
              models: [{ id: 'gpt-5.4', name: 'GPT-5.4' }],
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: 'api-proxy-gpt/gpt-5.4',
            },
          },
        },
        channels: {
          telegram: {
            enabled: true,
            botToken: {
              source: 'env',
              provider: 'default',
              id: 'TELEGRAM_BOT_TOKEN',
            },
          },
        },
      },
      null,
      2,
    ),
  )
  writeFileSync(
    join(localAgentDir, 'auth-profiles.json'),
    JSON.stringify(
      {
        version: 1,
        profiles: {
          'api-proxy-gpt:default': {
            type: 'api_key',
            provider: 'api-proxy-gpt',
            keyRef: {
              source: 'env',
              provider: 'default',
              id: 'QS_KEY',
            },
          },
        },
      },
      null,
      2,
    ),
  )

  const previousEnvironment = {
    APP_ORIGIN: process.env.APP_ORIGIN,
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
    QS_KEY: process.env.QS_KEY,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
  }
  process.env.APP_ORIGIN = 'https://www.genericagent.example.com,https://genericagent.example.com'
  process.env.MULTICA_DEPLOY_HOST = '47.251.171.158'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'
  process.env.QS_KEY = 'test-qs-key'
  process.env.USERPROFILE = fakeHome
  process.env.HOME = fakeHome

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'ssh-template-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-template',
      communicationToken: '123456:telegram-bot-token',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-template-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })

    const configBase64 = preview.script.match(/MULTICA_HOME_CONFIG_B64='([^']+)'/)?.[1]
    assert.ok(configBase64)
    const renderedConfig = JSON.parse(Buffer.from(configBase64, 'base64').toString('utf8'))
    assert.equal(renderedConfig.models.providers['api-proxy-gpt'].baseUrl, 'https://example-proxy.test/v1')
    assert.equal(renderedConfig.agents.defaults.model.primary, 'api-proxy-gpt/gpt-5.4')
    assert.equal(renderedConfig.agents.defaults.workspace, `${preview.plan.workspacePath}/.multica/workspace`)
    assert.equal(renderedConfig.gateway.mode, 'local')
    assert.equal(renderedConfig.gateway.controlUi.dangerouslyDisableDeviceAuth, true)
    assert.deepEqual(renderedConfig.gateway.controlUi.allowedOrigins, ['https://www.genericagent.example.com', 'https://genericagent.example.com'])
    assert.equal('auth' in renderedConfig, false)
    assert.equal(renderedConfig.channels.telegram.botToken.id, 'TELEGRAM_BOT_TOKEN')
    assert.equal('commands' in renderedConfig, false)
    assert.equal(preview.plan.environment.TELEGRAM_BOT_TOKEN, '123456:telegram-bot-token')
    assert.equal(preview.plan.environment.QS_KEY, undefined)
    assert.equal(preview.plan.environment.MULTICA_CHANNEL_BOUND, 'true')

    const authBase64 = preview.script.match(/AUTH_PROFILES_B64='([^']*)'/)?.[1]
    assert.ok(authBase64)
    const renderedAuthProfiles = JSON.parse(Buffer.from(authBase64, 'base64').toString('utf8'))
    assert.equal(renderedAuthProfiles.profiles['api-proxy-gpt:default'].provider, 'api-proxy-gpt')
    assert.match(preview.script, /state\/agents\/main\/agent\/auth-profiles\.json/)
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('SSH 部署模板在缺少本机 Multica 模板时会用 env 生成模型代理配置', () => {
  const tempDir = createTempDirectory('multica-generated-proxy-')
  const configPath = join(tempDir, 'multica.config.json')
  const fakeHome = join(tempDir, 'fake-home')
  createTestConfig(configPath, {
    deployment: {
      provider: 'ssh',
    },
  })

  const previousEnvironment = {
    PORT: process.env.PORT,
    MULTICA_DEPLOY_HOST: process.env.MULTICA_DEPLOY_HOST,
    MULTICA_DEPLOY_PORT: process.env.MULTICA_DEPLOY_PORT,
    MULTICA_DEPLOY_USERNAME: process.env.MULTICA_DEPLOY_USERNAME,
    MULTICA_DEPLOY_ROOT_PASSWORD: process.env.MULTICA_DEPLOY_ROOT_PASSWORD,
    MULTICA_TOKEN_SECRET: process.env.MULTICA_TOKEN_SECRET,
    MULTICA_MODEL_PROXY_BASE_URL: process.env.MULTICA_MODEL_PROXY_BASE_URL,
    MULTICA_MODEL_PROXY_INTERNAL_BASE_URL: process.env.MULTICA_MODEL_PROXY_INTERNAL_BASE_URL,
    MULTICA_MODEL_PROXY_PROVIDER_ID: process.env.MULTICA_MODEL_PROXY_PROVIDER_ID,
    MULTICA_MODEL_PROXY_API: process.env.MULTICA_MODEL_PROXY_API,
    MULTICA_MODEL_PROXY_MODEL_MAP_JSON: process.env.MULTICA_MODEL_PROXY_MODEL_MAP_JSON,
    QS_KEY: process.env.QS_KEY,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
  }
  process.env.MULTICA_DEPLOY_HOST = '47.251.171.158'
  process.env.MULTICA_DEPLOY_PORT = '22'
  process.env.MULTICA_DEPLOY_USERNAME = 'root'
  process.env.MULTICA_DEPLOY_ROOT_PASSWORD = 'env-password'
  process.env.PORT = '5175'
  process.env.MULTICA_TOKEN_SECRET = 'generated-proxy-token-secret'
  process.env.MULTICA_MODEL_PROXY_BASE_URL = 'https://thousandengine.com'
  process.env.MULTICA_MODEL_PROXY_PROVIDER_ID = 'thousand-engine'
  process.env.MULTICA_MODEL_PROXY_API = 'openai-completions'
  process.env.MULTICA_MODEL_PROXY_MODEL_MAP_JSON = JSON.stringify({
    'gemini-3-1-pro': 'gemini-3.1-pro-preview',
    'glm-4-7': 'glm-4.7',
    'glm-5-1': 'glm-5',
    'claude-opus-4-6': 'claude-opus-4-6',
    'gpt-5-4': 'gpt-5.4',
    'gemini-3-pro': 'gemini-3-pro-preview',
    'gpt-4-1': 'gpt-4.1',
  })
  process.env.QS_KEY = 'test-qs-key'
  process.env.USERPROFILE = fakeHome
  process.env.HOME = fakeHome

  try {
    const config = loadDeploymentConfig({
      configPath,
      encryptionSecret: 'ssh-generated-proxy-secret',
    })

    const preview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-generated-proxy',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-generated-proxy-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })

    const configBase64 = preview.script.match(/MULTICA_HOME_CONFIG_B64='([^']+)'/)?.[1]
    assert.ok(configBase64)
    const renderedConfig = JSON.parse(Buffer.from(configBase64, 'base64').toString('utf8'))
    assert.equal(
      renderedConfig.models.providers['thousand-engine'].baseUrl,
      'http://127.0.0.1:5175/api/internal/model-proxy/demo-claw-generated-proxy/v1',
    )
    assert.equal(renderedConfig.models.providers['thousand-engine'].api, 'openai-completions')
    assert.equal(
      renderedConfig.models.providers['thousand-engine'].models.find((model) => model.name === 'GPT-5.4')?.id,
      'gpt-5.4',
    )
    assert.equal(
      renderedConfig.models.providers['thousand-engine'].models.find((model) => model.name === 'Claude Opus 4.6')?.id,
      'claude-opus-4-6',
    )
    assert.equal(
      renderedConfig.models.providers['thousand-engine'].models.find((model) => model.name === 'Gemini 3 Pro')?.id,
      'gemini-3-pro-preview',
    )
    assert.equal(renderedConfig.agents.defaults.model.primary, 'thousand-engine/gpt-5.4')

    const authBase64 = preview.script.match(/AUTH_PROFILES_B64='([^']*)'/)?.[1]
    assert.ok(authBase64)
    const renderedAuthProfiles = JSON.parse(Buffer.from(authBase64, 'base64').toString('utf8'))
    assert.equal(renderedAuthProfiles.profiles['thousand-engine:default'].provider, 'thousand-engine')
    assert.equal(renderedAuthProfiles.profiles['thousand-engine:default'].keyRef.id, 'MULTICA_MODEL_PROXY_TOKEN')
    assert.equal(preview.plan.environment.QS_KEY, undefined)
    assert.equal(
      preview.plan.environment.MULTICA_MODEL_PROXY_TOKEN,
      buildModelProxyInternalToken('demo-claw-generated-proxy'),
    )

    const geminiPreview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-generated-proxy-gemini',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-generated-proxy-gemini-001',
        model_id: 'gemini-3-pro',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })
    const geminiConfigBase64 = geminiPreview.script.match(/MULTICA_HOME_CONFIG_B64='([^']+)'/)?.[1]
    assert.ok(geminiConfigBase64)
    const renderedGeminiConfig = JSON.parse(Buffer.from(geminiConfigBase64, 'base64').toString('utf8'))
    assert.equal(
      renderedGeminiConfig.agents.defaults.model.primary,
      'thousand-engine/gemini-3-pro-preview',
    )

    process.env.MULTICA_MODEL_PROXY_INTERNAL_BASE_URL = 'http://10.128.0.2:5175/api/internal/model-proxy'
    const privateBasePreview = createDeploymentPlanPreview(config, {
      instanceName: 'demo-claw-generated-proxy-private-base',
      communicationToken: '',
      user: { email: 'demo@example.com' },
      order: {
        id: 'order-generated-proxy-private-base-001',
        model_id: 'gpt-5-4',
        channel_id: 'telegram',
        plan_id: 'starter:monthly',
      },
    })
    const privateBaseConfigBase64 = privateBasePreview.script.match(/MULTICA_HOME_CONFIG_B64='([^']+)'/)?.[1]
    assert.ok(privateBaseConfigBase64)
    const renderedPrivateBaseConfig = JSON.parse(Buffer.from(privateBaseConfigBase64, 'base64').toString('utf8'))
    assert.equal(
      renderedPrivateBaseConfig.models.providers['thousand-engine'].baseUrl,
      'http://10.128.0.2:5175/api/internal/model-proxy/demo-claw-generated-proxy-private-base/v1',
    )
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})

test('内部模型代理会用服务器 QS_KEY 转发上游请求，而不是把 QS_KEY 暴露给实例', async () => {
  const tempDir = createTempDirectory('multica-model-proxy-route-')
  const configPath = join(tempDir, 'multica.config.json')
  const port = 5871
  const upstreamRequests = []
  createTestConfig(configPath)

  const upstreamServer = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    upstreamRequests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body: Buffer.concat(chunks).toString('utf8'),
    })

    response.statusCode = 200
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ ok: true }))
  })

  await new Promise((resolvePromise) => {
    upstreamServer.listen(0, resolvePromise)
  })

  const upstreamPort = upstreamServer.address().port
  const server = await startTestServer({
    port,
    configPath,
    env: {
      NODE_ENV: 'production',
      MULTICA_CONFIG_SECRET: 'proxy-config-secret',
      MULTICA_TOKEN_SECRET: 'proxy-token-secret',
      MULTICA_MODEL_PROXY_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
      MULTICA_MODEL_PROXY_CHAT_MAX_TOKENS_CAP: '1024',
      QS_KEY: 'server-only-qs-key',
    },
  })

  try {
    const instanceName = 'demo-instance'
    const modelProxyToken = buildModelProxyInternalToken(instanceName)
    const upstreamResponse = await fetch(
      `http://127.0.0.1:${port}/api/internal/model-proxy/${instanceName}/v1/chat/completions?mode=test`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${modelProxyToken}`,
        },
        body: JSON.stringify({ message: 'hello' }),
      },
    )

    assert.equal(upstreamResponse.status, 200)
    assert.deepEqual(await upstreamResponse.json(), { ok: true })
    assert.equal(upstreamRequests.length, 1)
    assert.equal(upstreamRequests[0].authorization, 'Bearer server-only-qs-key')
    assert.equal(upstreamRequests[0].url, '/v1/chat/completions?mode=test')
    assert.equal(upstreamRequests[0].body, JSON.stringify({ message: 'hello' }))

    const geminiResponse = await fetch(
      `http://127.0.0.1:${port}/api/internal/model-proxy/${instanceName}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${modelProxyToken}`,
        },
        body: JSON.stringify({
          model: 'gemini-3-pro-preview',
          messages: [{ role: 'user', content: 'hello' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'demo_tool',
                description: 'Demo tool',
                parameters: {
                  type: 'object',
                  patternProperties: {
                    '^x-': { type: 'string' },
                  },
                  properties: {
                    status: {
                      type: ['string', 'null'],
                      const: 'ready',
                      not: { type: 'number' },
                    },
                    payload: {
                      anyOf: [
                        { type: 'object', properties: { value: { type: ['string', 'null'] } } },
                        { type: 'null' },
                      ],
                    },
                  },
                },
              },
            },
          ],
        }),
      },
    )

    assert.equal(geminiResponse.status, 200)
    const geminiRequestBody = JSON.parse(upstreamRequests[1].body)
    const geminiToolParameters = geminiRequestBody.tools[0].function.parameters
    assert.equal(geminiToolParameters.patternProperties, undefined)
    assert.equal(geminiToolParameters.properties.status.const, undefined)
    assert.equal(geminiToolParameters.properties.status.not, undefined)
    assert.equal(geminiToolParameters.properties.status.type, 'string')
    assert.deepEqual(geminiToolParameters.properties.status.enum, ['ready'])
    assert.equal(geminiToolParameters.properties.payload.type, 'object')
    assert.equal(geminiToolParameters.properties.payload.properties.value.type, 'string')

    const cappedResponse = await fetch(
      `http://127.0.0.1:${port}/api/internal/model-proxy/${instanceName}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${modelProxyToken}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4',
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 4096,
        }),
      },
    )

    assert.equal(cappedResponse.status, 200)
    const cappedRequestBody = JSON.parse(upstreamRequests[2].body)
    assert.equal(cappedRequestBody.max_tokens, 1024)
    assert.equal(cappedRequestBody.max_completion_tokens, 1024)

    const unauthorizedResponse = await fetch(
      `http://127.0.0.1:${port}/api/internal/model-proxy/${instanceName}/v1/models`,
      {
        headers: {
          Authorization: 'Bearer wrong-token',
        },
      },
    )

    assert.equal(unauthorizedResponse.status, 401)
  } finally {
    await server.stop()
    await new Promise((resolvePromise) => {
      upstreamServer.close(resolvePromise)
    })
  }
})

test('PayPal 订单已被外部捕获时，前端回跳再次 capture 仍会把订单视为已支付', async () => {
  const tempDir = createTempDirectory('multica-paypal-completed-')
  const configPath = join(tempDir, 'multica.config.json')
  const dataDir = join(tempDir, 'data')
  const port = 5624
  createTestConfig(configPath, {
    deployment: {
      provider: 'mock',
      mockRootDir: './mock-remote',
    },
  })

  const payPal = await startMockPayPalServer()
  const server = await startServer({
    port,
    configPath,
    dataDir,
    env: {
      PAYMENT_PROVIDER: 'paypal',
      PAY_CLIENT_ID: 'paypal-client-id',
      PAY_SECRET: 'paypal-secret',
      PAYPAL_BASE_URL: payPal.baseUrl,
      PAYPAL_WEBHOOK_ID: 'paypal-webhook-id',
    },
  })

  try {
    const baseUrl = `http://localhost:${port}`
    const launch = await fetchJson(`${baseUrl}/api/launch-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'starter:monthly',
        modelId: 'gpt-5-4',
        channelId: 'telegram',
        communicationToken: 'telegram-paypal-completed-token',
      }),
    })

    const guestToken = new URL(launch.order.consolePath, baseUrl).searchParams.get('guest_token')
    assert.ok(guestToken)

    const checkout = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/checkout-session`, {
      method: 'POST',
      headers: {
        'x-multica-guest-token': guestToken,
      },
    })

    await fetchJson(`${payPal.baseUrl}/v2/checkout/orders/${checkout.paypalOrderId}/capture`, {
      method: 'POST',
    })

    const capture = await fetchJson(`${baseUrl}/api/orders/${launch.order.id}/paypal-capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-multica-guest-token': guestToken,
      },
      body: JSON.stringify({
        paypalOrderId: checkout.paypalOrderId,
      }),
    })

    assert.equal(capture.order.paymentStatus, 'paid')
  } finally {
    await server.stop()
    await payPal.stop()
  }
})
