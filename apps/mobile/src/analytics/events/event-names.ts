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

import type { TabbarEvent } from './contexts/tabbar'
import type { OnboardingEvent } from './contexts/onboarding'
import type { HomeEvent } from './contexts/home'
import type { BannersEvent } from './contexts/banners'
import type { AccountDetailsEvent } from './contexts/account-details'
import type { CardEvent } from './contexts/card'
import type { AssetDetailsEvent } from './contexts/asset-details'
import type { SwapEvent } from './contexts/swap'
import type { OnrampEvent } from './contexts/onramp'
import type { WalletConnectEvent } from './contexts/wallet-connect'
import type { MenuEvent } from './contexts/menu'
import type { SettingsEvent } from './contexts/settings'
import type { PasskeysEvent } from './contexts/passkeys'
import type { TransactionsEvent } from './contexts/transactions'
import type { FundEvent } from './contexts/fund'
import type { MultisigEvent } from './contexts/multisig'
import type { NotificationsEvent } from './contexts/notifications'
import type { StakingEvent } from './contexts/staking'
import type { AccountOptionsEvent } from './contexts/account-options'
import type { ContactsEvent } from './contexts/contacts'
import type { WebviewEvent } from './contexts/webview'

/**
 * Every analytics event, as a union of the per-context enums. Each enum lives in
 * its own file under `events/contexts/` (grouped by screen/context, mirroring the
 * i18n translation structure). Reference events through their context enum, e.g.
 * `SwapEvent.Completed`.
 */
export type AnalyticsEventName =
    | TabbarEvent
    | OnboardingEvent
    | HomeEvent
    | BannersEvent
    | AccountDetailsEvent
    | CardEvent
    | AssetDetailsEvent
    | SwapEvent
    | OnrampEvent
    | WalletConnectEvent
    | MenuEvent
    | SettingsEvent
    | PasskeysEvent
    | TransactionsEvent
    | FundEvent
    | MultisigEvent
    | NotificationsEvent
    | StakingEvent
    | AccountOptionsEvent
    | ContactsEvent
    | WebviewEvent
