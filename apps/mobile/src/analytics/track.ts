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
import {
    logEvent as baseLogEvent,
    createBaseLogger,
    type LogEventFn,
} from '@perawallet/wallet-core-analytics'
import type { AnalyticsEventName } from './events/event-names'
import type { AnalyticsScreenName } from './events/screen-names'
import type {
    NoPayloadEvent,
    OptionalEventPayloads,
    OptionalPayloadEvent,
    RequiredEventPayloads,
    RequiredPayloadEvent,
} from './events/payloads'

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

const createTrackEvent =
    (log: LogEventFn): TrackEventFn =>
    (name: AnalyticsEventName, payload?: EventPayload): void => {
        log(name, payload as Record<string, unknown> | undefined)
    }

const createTrackScreen =
    (log: LogEventFn): TrackScreenFn =>
    (name, metadata) => {
        log(name, metadata)
    }

/**
 * Tracks an analytics event from non-React code (stores, query functions, etc.).
 * React components/hooks should prefer `useAnalytics` (in `@hooks/useAnalytics`).
 */
export const trackEvent: TrackEventFn = createTrackEvent(baseLogEvent)

/** Tracks a screen-view event from non-React code. */
export const trackScreen: TrackScreenFn = createTrackScreen(baseLogEvent)

/** Factory used by `useAnalytics` to bind tracking to the context provider. */
export const createTrackers = (
    analytics: AnalyticsService,
): { trackEvent: TrackEventFn; trackScreen: TrackScreenFn } => {
    const log = createBaseLogger(analytics)
    return {
        trackEvent: createTrackEvent(log),
        trackScreen: createTrackScreen(log),
    }
}
