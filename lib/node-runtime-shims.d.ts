declare class Buffer extends Uint8Array {
  static from(value: string | ArrayBufferView, encoding?: string): Buffer
  static concat(values: readonly Uint8Array[]): Buffer
  toString(encoding?: string): string
}

declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(value: string | Uint8Array, encoding?: string): any
    digest(encoding?: string): any
  }
  export function createHmac(algorithm: string, key: string | Uint8Array): {
    update(value: string | Uint8Array, encoding?: string): any
    digest(encoding?: string): any
  }
  export function randomBytes(size: number): Buffer
  export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean
  export function createCipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): {
    update(value: string | Uint8Array, inputEncoding?: string): Buffer
    final(): Buffer
    getAuthTag(): Buffer
  }
  export function createDecipheriv(algorithm: string, key: Uint8Array, iv: Uint8Array): {
    update(value: Uint8Array): Buffer
    final(): Buffer
    setAuthTag(value: Uint8Array): void
  }
}
