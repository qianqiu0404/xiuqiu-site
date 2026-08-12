import { parseArticleCatalogKeys, verifyArticleCatalogRequest } from '../../lib/article-catalog-auth.js'

export function createHmacVerifier(scope, value, replayCache = new Map()) {
  const keys = parseArticleCatalogKeys(value)
  return ({ method, target, body, headers, now }) => verifyArticleCatalogRequest({
    keys, method, target, body, headers, now, replayCache,
  })
}

export function isLoopback(address = '') {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}
