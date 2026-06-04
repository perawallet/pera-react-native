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
 * the active network is testnet — matching the iOS `ALGAnalyticsEventName` behavior.
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
    analytics.logEvent(resolveName(name), payload)
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
    createTrackEvent(getProvider().analytics)(
        name as RequiredPayloadEvent,
        payload as RequiredEventPayloads[RequiredPayloadEvent],
    )
}) as TrackEventFn

/** Tracks a screen-view event from non-React code. */
export const trackScreen: TrackScreenFn = (name, metadata) => {
    createTrackScreen(getProvider().analytics)(name, metadata)
}

/** Internal factory used by {@link useAnalytics} to bind to the context provider. */
export const createTrackers = (
    analytics: AnalyticsService,
): { trackEvent: TrackEventFn; trackScreen: TrackScreenFn } => ({
    trackEvent: createTrackEvent(analytics),
    trackScreen: createTrackScreen(analytics),
})
