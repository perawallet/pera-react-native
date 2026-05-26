/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * The signing event bus decouples the signing actor lifecycle from any
 * particular React-side consumer. The lifecycle publishes lifecycle events
 * (analysis-ready, signing-started, completed, etc.) keyed by sign-request
 * id; consumers (hooks, drivers, listeners) subscribe — globally or per
 * request — and may replay retained events when they mount after the
 * lifecycle has already begun.
 *
 * Mirrors the `approvalGate` pattern: a `createSigningEventBus` factory for
 * tests + a module-level singleton (`signingEventBus`) for production
 * subscribers. Retained events live until `releaseRequest` is called by
 * the lifecycle's terminal handler.
 */

import type { SigningLifecycleEvent } from './signingEvents'

export type SigningEventHandler = (event: SigningLifecycleEvent) => void

export type SigningEventBus = {
    publish: (event: SigningLifecycleEvent) => void
    subscribe: (handler: SigningEventHandler) => () => void
    subscribeWithReplay: (
        requestId: string,
        handler: SigningEventHandler,
    ) => () => void
    replay: (requestId: string) => SigningLifecycleEvent[]
    releaseRequest: (requestId: string) => void
    /** Test-only — clears all subscribers and retained events. */
    __resetForTests: () => void
}

export const createSigningEventBus = (): SigningEventBus => {
    const subscribers = new Set<SigningEventHandler>()
    const retained = new Map<string, SigningLifecycleEvent[]>()

    const publish = (event: SigningLifecycleEvent) => {
        const id = event.request.id
        const bucket = retained.get(id)
        if (bucket) {
            bucket.push(event)
        } else {
            retained.set(id, [event])
        }
        for (const handler of subscribers) {
            handler(event)
        }
    }

    const subscribe = (handler: SigningEventHandler) => {
        subscribers.add(handler)
        return () => {
            subscribers.delete(handler)
        }
    }

    const subscribeWithReplay = (
        requestId: string,
        handler: SigningEventHandler,
    ) => {
        const history = retained.get(requestId)
        if (history) {
            for (const event of history) handler(event)
        }
        const wrapped: SigningEventHandler = event => {
            if (event.request.id !== requestId) return
            handler(event)
        }
        subscribers.add(wrapped)
        return () => {
            subscribers.delete(wrapped)
        }
    }

    const replay = (requestId: string): SigningLifecycleEvent[] => {
        return retained.get(requestId)?.slice() ?? []
    }

    const releaseRequest = (requestId: string) => {
        retained.delete(requestId)
    }

    const __resetForTests = () => {
        subscribers.clear()
        retained.clear()
    }

    return {
        publish,
        subscribe,
        subscribeWithReplay,
        replay,
        releaseRequest,
        __resetForTests,
    }
}

/** Module-level singleton — mirrors the approvalGate pattern. */
export const signingEventBus = createSigningEventBus()
