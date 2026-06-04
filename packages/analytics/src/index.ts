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

export const name = '@perawallet/wallet-core-analytics'

// Per-context event enums (grouped by screen/context, mirroring i18n).
export * from './events/contexts'

// Shared catalog types.
export type { AnalyticsEventName } from './events/event-names'
export { AnalyticsMetadataKey } from './events/metadata-keys'
export { AnalyticsScreenName } from './events/screen-names'
export type {
    RequiredEventPayloads,
    OptionalEventPayloads,
    RequiredPayloadEvent,
    OptionalPayloadEvent,
    NoPayloadEvent,
} from './events/payloads'

// Tracking API.
export {
    trackEvent,
    trackScreen,
    createTrackers,
    type TrackEventFn,
    type TrackScreenFn,
} from './track'
export { useAnalytics, type UseAnalyticsResult } from './useAnalytics'
