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

import type { AnalyticsEventName } from './event-names'
import type { OnboardingRequiredPayloads } from './contexts/onboarding'
import type { BannersRequiredPayloads } from './contexts/banners'
import type { AssetDetailsRequiredPayloads } from './contexts/asset-details'
import type {
    SwapRequiredPayloads,
    SwapOptionalPayloads,
} from './contexts/swap'
import type { WalletConnectRequiredPayloads } from './contexts/wallet-connect'
import type { SettingsRequiredPayloads } from './contexts/settings'
import type { TransactionsRequiredPayloads } from './contexts/transactions'
import type { NotificationsOptionalPayloads } from './contexts/notifications'
import type { StakingRequiredPayloads } from './contexts/staking'
import type { WebviewRequiredPayloads } from './contexts/webview'

/**
 * Events that REQUIRE a payload — composed from each context's required-payload
 * contribution. Payload object keys are {@link AnalyticsMetadataKey} values, so
 * they are forwarded to Firebase unchanged.
 */
export interface RequiredEventPayloads
    extends
        OnboardingRequiredPayloads,
        BannersRequiredPayloads,
        AssetDetailsRequiredPayloads,
        SwapRequiredPayloads,
        WalletConnectRequiredPayloads,
        SettingsRequiredPayloads,
        TransactionsRequiredPayloads,
        StakingRequiredPayloads,
        WebviewRequiredPayloads {}

/** Events that MAY carry a payload (all fields optional). */
export interface OptionalEventPayloads
    extends SwapOptionalPayloads, NotificationsOptionalPayloads {}

/** Event names that require a payload argument. */
export type RequiredPayloadEvent = keyof RequiredEventPayloads
/** Event names that accept an optional payload argument. */
export type OptionalPayloadEvent = keyof OptionalEventPayloads
/** Event names that take no payload. */
export type NoPayloadEvent = Exclude<
    AnalyticsEventName,
    RequiredPayloadEvent | OptionalPayloadEvent
>
