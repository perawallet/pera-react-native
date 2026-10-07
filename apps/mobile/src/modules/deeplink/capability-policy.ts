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

import type { CapabilityRequirement } from '@hooks/useCapability'
import { DeeplinkType, type DevLocaleTourDeeplinkType } from './types'

/**
 * What a deeplink needs before it may navigate: a deeplink must never reach a
 * screen its capability removed. `null` means it needs nothing.
 *
 * Exhaustive `Record` like `DEEPLINK_NOTIFICATION_POLICY`: a new `DeeplinkType`
 * fails to compile until it is classified. `useDeepLink` checks `CARDS` and
 * `SELL` beside this table, since their flag hooks already fold in the capability.
 */
export const DEEPLINK_CAPABILITY_REQUIREMENTS: Record<
    Exclude<DeeplinkType, DevLocaleTourDeeplinkType>,
    CapabilityRequirement | null
> = {
    [DeeplinkType.DISCOVER_PATH]: {
        platform: 'discoverTab',
        anyChain: 'discover',
    },
    [DeeplinkType.STAKING]: { platform: 'staking', anyChain: 'staking' },
    [DeeplinkType.SWAP]: { platform: 'swapTab', anyChain: 'swap' },
    [DeeplinkType.BUY]: { platform: 'fundTab' },
    [DeeplinkType.ADD_WATCH_ACCOUNT]: { anyChain: 'watchAccounts' },
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: {
        platform: 'sharedAccounts',
        anyChain: 'multisig',
    },
    [DeeplinkType.SIGN_REQUEST]: { anyChain: 'multisig' },
    [DeeplinkType.ASSET_OPT_IN]: { anyChain: 'manageAssets' },
    [DeeplinkType.ASSET_INBOX]: { anyChain: 'assetInbox' },
    [DeeplinkType.WALLET_CONNECT]: { anyChain: 'dappConnect' },
    [DeeplinkType.LIQUID_AUTH]: { anyChain: 'liquidAuth' },
    [DeeplinkType.PERA_WEB_IMPORT]: { anyChain: 'peraWebImport' },

    [DeeplinkType.ADD_CONTACT]: null,
    [DeeplinkType.EDIT_CONTACT]: null,
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: null,
    [DeeplinkType.ADDRESS_ACTIONS]: null,
    [DeeplinkType.ALGO_TRANSFER]: null,
    [DeeplinkType.ASSET_TRANSFER]: null,
    [DeeplinkType.KEYREG]: null,
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
}

const REQUIREMENT_BY_TYPE: Partial<
    Record<DeeplinkType, CapabilityRequirement | null>
> = DEEPLINK_CAPABILITY_REQUIREMENTS

export const capabilityRequirementForDeeplink = (
    type: DeeplinkType,
): CapabilityRequirement | null => REQUIREMENT_BY_TYPE[type] ?? null
