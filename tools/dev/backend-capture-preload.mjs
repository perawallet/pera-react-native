// Bun test preload for tools/dev/record-backend-responses.mjs: appends every
// request a backend route test sends through Elysia's `handle`, and its
// response, to $CAPTURE_OUT as one JSON line. Elysia assigns `handle` per
// instance in its constructor, so a prototype setter wraps each one.

import { appendFileSync } from 'node:fs'

const { Elysia } = await import(Bun.resolveSync('elysia', process.cwd()))
const handles = new WeakMap()

Object.defineProperty(Elysia.prototype, 'handle', {
    configurable: true,
    get() {
        return handles.get(this)
    },
    set(original) {
        handles.set(this, async request => {
            const requestBody =
                request.method === 'GET' ? null : await request.clone().text()
            const response = await original(request)
            appendFileSync(
                process.env.CAPTURE_OUT,
                `${JSON.stringify({
                    method: request.method,
                    url: request.url,
                    requestBody,
                    status: response.status,
                    body: await response.clone().text(),
                })}\n`,
            )
            return response
        })
    },
})
