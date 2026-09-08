import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const keywordsPath = path.join(root, 'src/data/affiliate-keywords.json')
const outputPath = path.join(root, 'src/data/affiliate-products.auto.json')

const accessKey = process.env.COUPANG_ACCESS_KEY?.trim()
const secretKey = process.env.COUPANG_SECRET_KEY?.trim()
const subId = process.env.COUPANG_SUB_ID?.trim()

const productsPerRole = Math.max(1, Number(process.env.COUPANG_PRODUCTS_PER_ROLE || 3))
const searchLimit = Math.min(10, Math.max(productsPerRole, Number(process.env.COUPANG_SEARCH_LIMIT || 5)))
const requestDelayMs = Math.max(1250, Number(process.env.COUPANG_REQUEST_DELAY_MS || 1300))

const baseUrl = 'https://api-gateway.coupang.com'
const searchPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function getSignedDatetime() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2)
}

function createAuthorization(method, pathname, query = '') {
  const signedDate = getSignedDatetime()
  const message = `${signedDate}${method}${pathname}${query}`
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex')

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`
}

async function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

function normalizeProduct(product, keyword) {
  if (!product?.productName || !product?.productUrl) return null

  return {
    productId: product.productId ?? null,
    name: product.productName,
    image: String(product.productImage || '').replace(/^http:\/\//, 'https://'),
    price: Number(product.productPrice || 0),
    url: product.productUrl,
    isRocket: Boolean(product.isRocket),
    isFreeShipping: Boolean(product.isFreeShipping),
    keyword,
  }
}

async function searchProducts(keyword, retry = 0) {
  const params = new URLSearchParams({
    keyword,
    limit: String(searchLimit),
    imageSize: '512x512',
    srpLinkOnly: 'false',
  })
  if (subId) params.set('subId', subId)

  const query = params.toString()
  const authorization = createAuthorization('GET', searchPath, query)
  const response = await fetch(`${baseUrl}${searchPath}?${query}`, {
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 429 && retry < 2) {
    const waitMs = 10000 * (retry + 1)
    console.warn(`[Coupang] Rate limited for "${keyword}". Retrying in ${waitMs / 1000}s...`)
    await sleep(waitMs)
    return searchProducts(keyword, retry + 1)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const json = await response.json()
  if (String(json?.rCode) !== '0') {
    throw new Error(`${json?.rCode ?? 'UNKNOWN'} ${json?.rMessage ?? 'Coupang API error'}`)
  }

  const rows = Array.isArray(json?.data?.productData) ? json.data.productData : []
  return rows.map(product => normalizeProduct(product, keyword)).filter(Boolean)
}

async function main() {
  if (!accessKey || !secretKey) {
    console.log('[Coupang] API keys are not configured. Keeping the existing manual/iframe recommendations.')
    console.log('[Coupang] Add COUPANG_ACCESS_KEY and COUPANG_SECRET_KEY to GitHub Actions Secrets to enable automatic product generation.')
    return
  }

  const keywordsByRole = await readJson(keywordsPath, {})
  const previousOutput = await readJson(outputPath, {})
  const cache = new Map()
  const nextOutput = { ...previousOutput }

  const uniqueKeywords = [...new Set(Object.values(keywordsByRole).flat().filter(Boolean))]
  console.log(`[Coupang] Searching ${uniqueKeywords.length} unique keyword(s)...`)

  for (let i = 0; i < uniqueKeywords.length; i += 1) {
    const keyword = uniqueKeywords[i]
    try {
      const products = await searchProducts(keyword)
      cache.set(keyword, products)
      console.log(`[Coupang] ${i + 1}/${uniqueKeywords.length} "${keyword}": ${products.length} result(s)`)
    } catch (error) {
      cache.set(keyword, null)
      console.warn(`[Coupang] ${i + 1}/${uniqueKeywords.length} "${keyword}" failed: ${error.message}`)
    }

    if (i < uniqueKeywords.length - 1) await sleep(requestDelayMs)
  }

  for (const [roleId, keywords] of Object.entries(keywordsByRole)) {
    const merged = []
    const seen = new Set()
    let hadSuccessfulSearch = false

    for (const keyword of keywords) {
      const products = cache.get(keyword)
      if (!products) continue
      hadSuccessfulSearch = true

      for (const product of products) {
        const key = product.productId ? String(product.productId) : product.url
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(product)
        if (merged.length >= productsPerRole) break
      }

      if (merged.length >= productsPerRole) break
    }

    if (hadSuccessfulSearch) nextOutput[roleId] = merged.slice(0, productsPerRole)
  }

  await fs.writeFile(outputPath, `${JSON.stringify(nextOutput, null, 2)}\n`, 'utf8')
  console.log(`[Coupang] Wrote automatic recommendations to ${path.relative(root, outputPath)}.`)
}

main().catch(error => {
  console.error('[Coupang] Generator failed:', error)
  console.error('[Coupang] Existing manual/iframe recommendations remain available as fallback.')
  process.exitCode = 0
})
