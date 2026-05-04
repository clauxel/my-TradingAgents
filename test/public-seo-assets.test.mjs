import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const expectedMarketingUrls = [
  'https://www.tradingagents-ai.com/',
  'https://www.tradingagents-ai.com/compare/tradingagents-vs-single-llm',
  'https://www.tradingagents-ai.com/compare/tradingagents-vs-manual-research',
  'https://www.tradingagents-ai.com/solutions/equity-research-desk',
  'https://www.tradingagents-ai.com/solutions/paper-trading-lab',
  'https://www.tradingagents-ai.com/solutions/risk-review-workflows',
  'https://www.tradingagents-ai.com/resources/tradingagents-github',
  'https://www.tradingagents-ai.com/resources/tradingagents-cn',
  'https://www.tradingagents-ai.com/resources/tradingagents-ai',
  'https://www.tradingagents-ai.com/resources/tradingagents-reddit',
  'https://www.tradingagents-ai.com/resources/tradingagents-docker',
  'https://www.tradingagents-ai.com/resources/tradingagents-review',
  'https://www.tradingagents-ai.com/resources/tradingagents-paper',
  'https://www.tradingagents-ai.com/resources/trading-agents-arxiv',
  'https://www.tradingagents-ai.com/privacy',
  'https://www.tradingagents-ai.com/terms',
]

test('static SEO assets point at the live TradingAgents origin', () => {
  const indexHtml = readFileSync(join(projectRoot, 'index.html'), 'utf8')
  const robotsTxt = readFileSync(join(projectRoot, 'public', 'robots.txt'), 'utf8')
  const sitemapXml = readFileSync(join(projectRoot, 'public', 'sitemap.xml'), 'utf8')

  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/www\.tradingagents-ai\.com\/" \/>/)
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/www\.tradingagents-ai\.com\/" \/>/)
  assert.doesNotMatch(indexHtml, /github\.com\/lsdefine\/GenericAgent/)

  assert.match(robotsTxt, /^Sitemap: https:\/\/www\.tradingagents-ai\.com\/sitemap\.xml$/m)

  assert.match(sitemapXml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.doesNotMatch(sitemapXml, /<urlset[^>]*\/>/)
  assert.equal(sitemapXml.match(/<url>/g)?.length ?? 0, expectedMarketingUrls.length)

  for (const url of expectedMarketingUrls) {
    assert.match(sitemapXml, new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`))
  }
})
