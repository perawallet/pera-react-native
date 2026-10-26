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

import type { RequestHandler } from 'msw'
import { setupServer } from 'msw/native'

export type FixtureNetwork = {
    /** Handlers served from now until `reset()`. */
    use: (...handlers: RequestHandler[]) => void
    /** Drops every handler `use` added and zeroes the counters. */
    reset: () => void
    /** Requests seen since the last `reset()`, answered or not. */
    requestCount: () => number
    /** `METHOD url` of every request no handler answered since the last `reset()`. */
    unhandledRequests: () => string[]
}

/**
 * Every request the scenarios make is answered here. An unanswered one is
 * recorded and refused, so a scenario can never reach a real backend.
 */
export const startFixtureNetwork = (): FixtureNetwork => {
    let requests = 0
    let unhandled: string[] = []

    const server = setupServer()
    server.events.on('request:start', () => {
        requests += 1
    })
    server.listen({
        onUnhandledRequest: (request, print) => {
            unhandled.push(`${request.method} ${request.url}`)
            print.error()
        },
    })

    return {
        use: (...handlers) => server.use(...handlers),
        reset: () => {
            server.resetHandlers()
            requests = 0
            unhandled = []
        },
        requestCount: () => requests,
        unhandledRequests: () => [...unhandled],
    }
}
