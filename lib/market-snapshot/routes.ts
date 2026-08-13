export function marketRoutePath(url: string | undefined): string {
  return (url || '').split('?', 1)[0].replace(/^\/api\//, '').replace(/^\/+|\/+$/g, '')
}
