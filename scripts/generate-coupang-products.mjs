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
const forceRefresh = String(process.env.COUPANG_FORCE_REFRESH || '').toLowerCase() === 'true'

const productsPerRole = Math.max(1, Number(process.env.COUPANG_PRODUCTS_PER_ROLE || 3))
const searchLimit = Math.min(10, Math.max(productsPerRole, Number(process.env.COUPANG_SEARCH_LIMIT || 5)))
const requestDelayMs = Math.max(1250, Number(process.env.COUPANG_REQUEST_DELAY_MS || 1300))

const baseUrl = 'https://api-gateway.coupang.com'
const searchPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search'

const gameDevTerms = [
  '게임', 'game', 'unreal', 'unity', 'c++', 'cpp', '그래픽', 'graphics', 'render', '렌더',
  'shader', '셰이더', 'vfx', 'fx', '애니메이션', 'animation', '캐릭터', 'character', '레벨',
  'level', '엔진', 'engine', '프로그래밍', 'programming', '코딩', 'code', '서버', 'server',
  '네트워크', 'network', 'ai', '인공지능', '테크니컬 아티스트', 'technical artist', 'qa', '테스트',
  'test', 'ui', 'ux', '사운드', 'sound', 'audio', '시나리오', 'narrative', '스토리', 'story',
  '기획', 'design', '디자인', '3d', '모델링', 'modeling', '라이팅', 'lighting', '시네마틱',
  'cinematic', '퍼블리싱', 'publishing', '마케팅', 'marketing', '데이터', 'data', '운영', 'live',
]

const excludeTerms = [
  '수능', '공무원', '토익', '토플', '자격증', '초등', '중등', '고등', '어린이', '유아',
  '동화', '소설', '만화', '웹툰', '문제집', '워크북', '색칠', '퍼즐', '스티커', '보드게임',
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function normalizeText(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

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
    updatedAt: new Date().toISOString(),
  }
}

function scoreProduct(product, keyword) {
  const title = normalizeText(product?.name)
  const query = normalizeText(keyword)
  if (!title) return -999

  let score = 0

  const queryTokens = query.split(/[^a-z0-9가-힣+#]+/i).filter(token => token.length >= 2)
  const matchedQueryTokens = queryTokens.filter(token => title.includes(token)).length
  score += matchedQueryTokens * 5

  if (query && title.includes(query)) score += 10

  const gameDevHits = gameDevTerms.filter(term => title.includes(normalizeText(term))).length
  score += Math.min(gameDevHits, 5) * 3

  const excludedHits = excludeTerms.filter(term => title.includes(normalizeText(term))).length
  score -= excludedHits * 8

  return score
}

function filterAndRankProducts(products, keyword) {
  const ranked = products
    .map(product => ({ product, score: scoreProduct(product, keyword) }))
    .filter(item => item.score >= 5)
    .sort((a, b) => b.score - a.score)

  const strict = ranked.filter(item => {
    const title = normalizeText(item.product.name)
    const hasGameDevTerm = gameDevTerms.some(term => title.includes(normalizeText(term)))
    const hasQueryMatch = normalizeText(keyword)
      .split(/[^a-z0-9가-힣+#]+/i)
      .filter(token => token.length >= 2)
      .some(token => title.includes(token))
    return hasGameDevTerm && hasQueryMatch
  })

  const selected = strict.length > 0 ? strict : ranked
  return selected.map(item => item.product).slice(0, searchLimit)
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
  const normalized = rows.map(product => normalizeProduct(product, keyword)).filter(Boolean)
  const filtered = filterAndRankProducts(normalized, keyword)

  if (filtered.length === 0 && normalized.length > 0) {
    console.warn(`[Coupang] "${keyword}": search returned products, but none passed the game-development relevance filter.`)
  }

  return filtered
}

function cacheMatchesKeywords(existing, keywords) {
  if (!Array.isArray(existing) || existing.length === 0) return false
  const allowed = new Set(keywords)
  return existing.every(product => product?.keyword && allowed.has(product.keyword))
}

async function main() {
  const keywordsByRole = await readJson(keywordsPath, {})
  const previousOutput = await readJson(outputPath, {})

  const rolesToRefresh = Object.entries(keywordsByRole).filter(([roleId, keywords]) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return false
    if (forceRefresh) return true
    const existing = previousOutput[roleId]
    return !cacheMatchesKeywords(existing, keywords)
  })

  if (rolesToRefresh.length === 0) {
    console.log('[Coupang] All roles already have matching cached JSON data. No API call is needed.')
    console.log('[Coupang] Set COUPANG_FORCE_REFRESH=true when you want to refresh the cached products.')
    return
  }

  if (!accessKey || !secretKey) {
    console.log(`[Coupang] ${rolesToRefresh.length} role(s) need data, but API keys are not configured.`)
    console.log('[Coupang] Existing cached/manual recommendations will remain unchanged.')
    return
  }

  const cache = new Map()
  const nextOutput = { ...previousOutput }
  const neededKeywords = [...new Set(rolesToRefresh.flatMap(([, keywords]) => keywords).filter(Boolean))]

  console.log(`[Coupang] ${forceRefresh ? 'Refreshing' : 'Refreshing missing/stale keyword data for'} ${rolesToRefresh.length} role(s).`)
  console.log(`[Coupang] API searches needed: ${neededKeywords.length} unique keyword(s).`)

  for (let i = 0; i < neededKeywords.length; i += 1) {
    const keyword = neededKeywords[i]
    try {
      const products = await searchProducts(keyword)
      cache.set(keyword, products)
      console.log(`[Coupang] ${i + 1}/${neededKeywords.length} "${keyword}": ${products.length} filtered result(s)`)
    } catch (error) {
      cache.set(keyword, null)
      console.warn(`[Coupang] ${i + 1}/${neededKeywords.length} "${keyword}" failed: ${error.message}`)
    }

    if (i < neededKeywords.length - 1) await sleep(requestDelayMs)
  }

  for (const [roleId, keywords] of rolesToRefresh) {
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

    if (hadSuccessfulSearch && merged.length > 0) {
      nextOutput[roleId] = merged.slice(0, productsPerRole)
    } else {
      console.warn(`[Coupang] ${roleId}: no sufficiently relevant game-development book was found; keeping previous cache/fallback.`)
    }
  }

  await fs.writeFile(outputPath, `${JSON.stringify(nextOutput, null, 2)}\n`, 'utf8')
  console.log(`[Coupang] Cached recommendations saved to ${path.relative(root, outputPath)}.`)
}

main().catch(error => {
  console.error('[Coupang] Generator failed:', error)
  console.error('[Coupang] Existing cached/manual recommendations remain available as fallback.')
  process.exitCode = 0
})
