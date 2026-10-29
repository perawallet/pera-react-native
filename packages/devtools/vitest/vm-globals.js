// The vmThreads pool's jsdom context lacks Node's web-stream globals, which
// msw reads at import time, and a `crypto.subtle`; the forks pool has both.
import { webcrypto } from 'node:crypto'
import {
    ReadableStream,
    TransformStream,
    WritableStream,
} from 'node:stream/web'

globalThis.WritableStream ??= WritableStream
globalThis.ReadableStream ??= ReadableStream
globalThis.TransformStream ??= TransformStream
if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        configurable: true,
    })
}
