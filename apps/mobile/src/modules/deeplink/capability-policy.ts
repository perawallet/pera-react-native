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

import {
    chainRequirementOf,
    DeeplinkType,
} from '@perawallet/wallet-core-deeplinks'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { CapabilityRequirement } from '@hooks/useCapability'
import type { RouteCapability } from '@routes/capabilities'
import { isDevE2eFixtureDeeplink } from './dev-e2e-fixture-parser'
import { isDevLocaleTourDeeplink } from './dev-locale-tour-parser'
import type { AppDeeplink } from './types'

/**
 * The app route a deeplink lands on, which must be on before it may navigate.
 * The chain capability half lives with the link types in
 * `DEEPLINK_CHAIN_CAPABILITY`. `useDeepLink` checks `CARDS`, `SELL` and
 * `CLOUD_BACKUP` beside both, since their flag hooks already fold in the
 * capability.
 */
export const DEEPLINK_ROUTE_REQUIREMENTS: Record<
    DeeplinkType,
    Nullable<RouteCapability>
> = {
    [DeeplinkType.SWAP]: 'swapTab',
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: 'sharedAccounts',
    [DeeplinkType.BUY]: 'fundTab',
    [DeeplinkType.DISCOVER_PATH]: 'discoverTab',
    [DeeplinkType.STAKING]: 'staking',
    [DeeplinkType.SCAN]: 'qrScanner',

    [DeeplinkType.TRANSFER]: null,
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: null,
    [DeeplinkType.CHAIN_ACTION]: null,
    [DeeplinkType.ASSET_OPT_IN]: null,
    [DeeplinkType.ASSET_INBOX]: null,
    [DeeplinkType.ADD_WATCH_ACCOUNT]: null,
    [DeeplinkType.SIGN_REQUEST]: null,
    [DeeplinkType.WALLET_CONNECT]: null,
    [DeeplinkType.LIQUID_AUTH]: null,
    [DeeplinkType.PERA_WEB_IMPORT]: null,
    [DeeplinkType.ADDRESS_ACTIONS]: null,
    [DeeplinkType.ADD_CONTACT]: null,
    [DeeplinkType.EDIT_CONTACT]: null,
    [DeeplinkType.RECOVER_ADDRESS]: null,
    [DeeplinkType.ASSET_DETAIL]: null,
    [DeeplinkType.ASSET_TRANSACTIONS]: null,
    [DeeplinkType.CARDS]: null,
    [DeeplinkType.SELL]: null,
    [DeeplinkType.ACCOUNT_DETAIL]: null,
    // Both open a URL in the webview stack and never reach the Discover tab.
    [DeeplinkType.INTERNAL_BROWSER]: null,
    [DeeplinkType.DISCOVER_BROWSER]: null,
    [DeeplinkType.HOME]: null,
    [DeeplinkType.NFT_DETAIL]: null,
    [DeeplinkType.CLOUD_BACKUP]: null,
    [DeeplinkType.PASSPHRASE_BACKUP]: null,
    [DeeplinkType.INBOX]: null,
    [DeeplinkType.NOTIFICATIONS]: null,
    [DeeplinkType.PORTFOLIO]: null,
}

/** The link's route and chain requirements together; null when it needs neither. */
export const capabilityRequirementForDeeplink = (
    link: AppDeeplink,
): Nullable<CapabilityRequirement> => {
    if (isDevLocaleTourDeeplink(link) || isDevE2eFixtureDeeplink(link)) {
        return null
    }
    const platform = DEEPLINK_ROUTE_REQUIREMENTS[link.type] ?? undefined
    const chainRequirement = chainRequirementOf(link)
    if (!platform && !chainRequirement) return null
    return { platform, ...chainRequirement }
}
