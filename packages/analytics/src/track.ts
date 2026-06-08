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

import type { AnalyticsService } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { isTestnet } from '@perawallet/wallet-core-config'
import type { AnalyticsEventName } from './events/event-names'
import type { AnalyticsScreenName } from './events/screen-names'
import type {
    NoPayloadEvent,
    OptionalEventPayloads,
    OptionalPayloadEvent,
    RequiredEventPayloads,
    RequiredPayloadEvent,
} from './events/payloads'

const TESTNET_PREFIX = 't_'

/**
 * Resolves the raw event/screen name to send, prepending the testnet prefix when
 * the active network is testnet.
 */
const resolveName = (name: string): string => {
    const { network } = useNetworkStore.getState()
    return isTestnet(network) ? `${TESTNET_PREFIX}${name}` : name
}

type EventPayload =
    | RequiredEventPayloads[RequiredPayloadEvent]
    | OptionalEventPayloads[OptionalPayloadEvent]

/** Overloaded event tracker — the compiler requires/forbids payloads per event. */
export interface TrackEventFn {
    (name: NoPayloadEvent): void
    <E extends RequiredPayloadEvent>(
        name: E,
        payload: RequiredEventPayloads[E],
    ): void
    <E extends OptionalPayloadEvent>(
        name: E,
        payload?: OptionalEventPayloads[E],
    ): void
}

export type TrackScreenFn = (
    name: AnalyticsScreenName,
    metadata?: Record<string, unknown>,
) => void

const logEvent = (
    analytics: AnalyticsService,
    name: string,
    payload?: Record<string, unknown>,
): void => {
    try {
        analytics.logEvent(resolveName(name), payload)
    } catch (error) {
        // Analytics is best-effort and must NEVER break app flow — swallow
        // any failure (provider, network store, logEvent) and only log it.
        // console.warn is used over the shared logger so this package stays
        // free of the wallet-core-shared barrel (and its native side effects).
        // The event name is intentionally omitted: some names reference the
        // passphrase backup flow and static analysis flags them as sensitive.
        console.warn('[analytics] Failed to track event', error)
    }
}

const createTrackEvent =
    (analytics: AnalyticsService): TrackEventFn =>
    (name: AnalyticsEventName, payload?: EventPayload): void => {
        logEvent(
            analytics,
            name,
            payload as Record<string, unknown> | undefined,
        )
    }

const createTrackScreen =
    (analytics: AnalyticsService): TrackScreenFn =>
    (name, metadata) => {
        logEvent(analytics, name, metadata)
    }

/**
 * Tracks an analytics event from non-React code (stores, query functions, etc.).
 * React components/hooks should prefer {@link useAnalytics}.
 */
export const trackEvent: TrackEventFn = ((
    name: AnalyticsEventName,
    payload?: EventPayload,
) => {
    try {
        createTrackEvent(getProvider().analytics)(
            name as RequiredPayloadEvent,
            payload as RequiredEventPayloads[RequiredPayloadEvent],
        )
    } catch (error) {
        console.warn('[analytics] Failed to track event', error)
    }
}) as TrackEventFn

/** Tracks a screen-view event from non-React code. */
export const trackScreen: TrackScreenFn = (name, metadata) => {
    try {
        createTrackScreen(getProvider().analytics)(name, metadata)
    } catch (error) {
        console.warn('[analytics] Failed to track screen', error)
    }
}

/** Internal factory used by {@link useAnalytics} to bind to the context provider. */
export const createTrackers = (
    analytics: AnalyticsService,
): { trackEvent: TrackEventFn; trackScreen: TrackScreenFn } => ({
    trackEvent: createTrackEvent(analytics),
    trackScreen: createTrackScreen(analytics),
})
