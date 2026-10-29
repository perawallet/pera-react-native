/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { getResponse, type RequestHandler } from 'msw'

export type FixtureNetwork = {
    /** Handlers served from now until `reset()`; later ones take precedence. */
    use: (...handlers: RequestHandler[]) => void
    /** Drops every handler `use` added and zeroes the counters. */
    reset: () => void
    /** Requests seen since the last `reset()`, answered or not. */
    requestCount: () => number
    /** `METHOD url` of every request no handler answered since the last `reset()`. */
    unhandledRequests: () => string[]
}

// NetInfo polls this on its own schedule (the bench never applies the app's
// configured URL). Refusing it would read as offline, and counting it would let
// a tick that did nothing pass the request-count check.
const isReachabilityProbe = (request: Request): boolean =>
    new URL(request.url).pathname === '/generate_204'

/**
 * Every request the scenarios make is answered here. An unanswered one is
 * recorded and refused, so a scenario can never reach a real backend.
 *
 * Replaces `fetch` rather than using `msw/native`'s interceptors: they rebuild
 * the mocked response from `response.body`, which RN's whatwg-fetch `Response`
 * does not have, so every fixture reached the app with an empty body. The
 * handler's own `Response` is returned untouched. The app's ky clients read
 * `globalThis.fetch` per request, so replacing it after import still applies.
 */
export const startFixtureNetwork = (): FixtureNetwork => {
    let handlers: RequestHandler[] = []
    let requests = 0
    let unhandled: string[] = []

    // oxlint-disable-next-line no-restricted-properties -- installs the fixture replayer in place of the network, as the comment above explains
    globalThis.fetch = async (input, init) => {
        const request = new Request(input, init)
        if (isReachabilityProbe(request)) {
            return new Response(null, { status: 204 })
        }
        requests += 1
        const response = await getResponse(handlers, request)
        if (!response) {
            const line = `${request.method} ${request.url}`
            unhandled.push(line)
            throw new TypeError(`No fixture answers ${line}`)
        }
        return response
    }

    return {
        use: (...added) => {
            handlers = [...added, ...handlers]
        },
        reset: () => {
            handlers = []
            requests = 0
            unhandled = []
        },
        requestCount: () => requests,
        unhandledRequests: () => [...unhandled],
    }
}
