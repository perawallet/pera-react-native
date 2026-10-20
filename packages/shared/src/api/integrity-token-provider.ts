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

import type { IntegrityRequiredError } from '../errors/integrity'

type IntegrityTokenProvider = () => string | null
type IntegrityTokenWaiter = () => Promise<void>
type IntegrityRefusedHandler = (error: IntegrityRequiredError) => void

let provider: IntegrityTokenProvider | null = null

/**
 * Inverts the dependency: `setStandardHeaders` needs the app-integrity token,
 * but `@perawallet/wallet-core-app-integrity` already depends on this package,
 * so it registers its getter here instead. Each realm's bootstrap calls this
 * once — the service worker and the web UI have separate module instances.
 */
export const setIntegrityTokenProvider = (
    next: IntegrityTokenProvider,
): void => {
    provider = next
}

export const readIntegrityToken = (): string | null => {
    try {
        return provider?.() ?? null
    } catch {
        return null
    }
}

let waiter: IntegrityTokenWaiter | null = null

/**
 * Registers how this realm waits for a token before a guarded Pera request
 * that would go out without one. The waiter owns the bound (a few seconds, and
 * only while a token is on its way) and must resolve rather than reject.
 */
export const setIntegrityTokenWaiter = (
    next: IntegrityTokenWaiter | null,
): void => {
    waiter = next
}

export const waitForIntegrityToken = async (): Promise<void> => {
    try {
        await waiter?.()
    } catch {
        // A failed wait only means the request goes out without a token.
    }
}

let refusedHandler: IntegrityRefusedHandler | undefined

/**
 * Registers the single handler told whenever a Pera request is refused for its
 * integrity token, from a query, a mutation or a direct call alike. Returns a
 * cleanup that unregisters it.
 */
export const setOnIntegrityRefused = (
    handler: IntegrityRefusedHandler,
): (() => void) => {
    refusedHandler = handler
    return () => {
        if (refusedHandler === handler) refusedHandler = undefined
    }
}

export const notifyIntegrityRefused = (error: IntegrityRequiredError): void => {
    try {
        refusedHandler?.(error)
    } catch {
        // The request already failed; a broken handler must not mask why.
    }
}
