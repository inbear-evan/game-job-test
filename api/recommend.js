import crypto from 'node:crypto'
import fs from 'node:fs'

const keywordsByRole = JSON.parse(
  fs.readFileSync(new URL('../src/data/affiliate-keywords.json', import.meta.url), 'utf8'),
)

const BASE_URL = 'https://api-gateway.coupang.com'
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search'
const DEFAULT_LIMIT = 3
const ALLOWED_ORIGIN = 'https://inbear-evan.github.io'

function signedDatetime() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(2)
}

function createAuthorization(method, pathname, query, accessKey, secretKey) {
  const datetime = signedDatetime()
  const message = `${datetime}${method}${pathname}${query}`
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex')

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' })

  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim()
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim()
  const subId = process.env.COUPANG_SUB_ID?.trim()

  if (!accessKey || !secretKey) {
    return res.status(503).json({ message: 'Coupang API credentials are not configured.' })
  }

  const job = String(req.query?.job || '').trim()
  const keywords = keywordsByRole[job]
  if (!job || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ message: 'Unknown or unsupported job id.' })
  }

  const keyword = String(keywords[0]).trim()
  const params = new URLSearchParams({
    keyword,
    limit: String(DEFAULT_LIMIT),
    imageSize: '512x512',
    srpLinkOnly: 'false',
  })
  if (subId) params.set('subId', subId)

  const query = params.toString()
  const authorization = createAuthorization('GET', SEARCH_PATH, query, accessKey, secretKey)

  try {
    const response = await fetch(`${BASE_URL}${SEARCH_PATH}?${query}`, {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || String(payload?.rCode) !== '0') {
      const message = payload?.rMessage || `Coupang API HTTP ${response.status}`
      return res.status(502).json({ message })
    }

    const rows = Array.isArray(payload?.data?.productData) ? payload.data.productData : []
    const products = rows
      .map(product => normalizeProduct(product, keyword))
      .filter(Boolean)
      .slice(0, DEFAULT_LIMIT)

    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found.' })
    }

    return res.status(200).json({ job, keyword, products })
  } catch (error) {
    console.error('[Coupang API proxy]', error)
    return res.status(502).json({ message: 'Failed to reach Coupang API.' })
  }
}
