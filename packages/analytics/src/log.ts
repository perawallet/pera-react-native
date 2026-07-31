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

import type { AnalyticsService } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { isMainnet } from '@perawallet/wallet-core-config'

const TESTNET_PREFIX = 't_'

/**
 * Resolves the raw event/screen name to send, prefixing on every network that
 * is not MainNet. The `t_` prefix is shared across every Pera client app, so
 * betanet and custom reuse it rather than introducing per-network prefixes
 * that would fragment existing dashboards.
 */
export const resolveEventName = (name: string): string => {
    const { network } = useNetworkStore.getState()
    return isMainnet(network) ? name : `${TESTNET_PREFIX}${name}`
}

/**
 * The base, untyped logging primitive. Client apps build their own type-safe
 * `trackEvent`/`trackScreen` (with app-specific event catalogs) on top of this.
 */
export type LogEventFn = (
    name: string,
    payload?: Record<string, unknown>,
) => void

const safeLog = (
    analytics: AnalyticsService,
    name: string,
    payload?: Record<string, unknown>,
): void => {
    try {
        analytics.logEvent(resolveEventName(name), payload)
    } catch (error) {
        // Analytics is best-effort and must NEVER break app flow — swallow
        // any failure (network store, logEvent) and only log it. console.warn
        // is used over the shared logger so this package stays free of the
        // wallet-core-shared barrel (and its native side effects). The event
        // name is intentionally omitted: some names reference the passphrase
        // backup flow and static analysis flags them as sensitive.
        console.warn('[analytics] Failed to track event', error)
    }
}

/**
 * Binds a base logger to a specific {@link AnalyticsService} instance. Used by
 * React hooks that resolve the service from the platform provider context.
 */
export const createBaseLogger = (analytics: AnalyticsService): LogEventFn => {
    return (name, payload) => safeLog(analytics, name, payload)
}

/**
 * Base event logger for non-React code (stores, query functions, etc.). Resolves
 * the analytics service lazily from the global provider.
 */
export const logEvent: LogEventFn = (name, payload) => {
    try {
        safeLog(getProvider().analytics, name, payload)
    } catch (error) {
        console.warn('[analytics] Failed to track event', error)
    }
}
