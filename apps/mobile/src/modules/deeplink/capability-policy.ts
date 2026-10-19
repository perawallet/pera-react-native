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

import type { ChainCapability } from '@perawallet/wallet-core-chain-contract'
import { DeeplinkType } from '@perawallet/wallet-core-deeplinks'
import type { CapabilityRequirement } from '@hooks/useCapability'
import type { RouteCapability } from '@routes/capabilities'
import type { AppDeeplink } from './types'

export type DeeplinkCapabilityRequirement = {
    platform?: RouteCapability
    /** Checked on the chain the link targets. */
    chain?: ChainCapability
    /** Only for a type that names no chain; held when any chain has it. */
    anyChain?: ChainCapability
}

/**
 * What a deeplink needs before it may navigate: a deeplink must never reach a
 * screen its capability removed. `null` means it needs nothing.
 *
 * Exhaustive `Record` like `DEEPLINK_NOTIFICATION_POLICY`: a new `DeeplinkType`
 * fails to compile until it is classified. `useDeepLink` checks `CARDS` and
 * `SELL` beside this table, since their flag hooks already fold in the capability.
 */
export const DEEPLINK_CAPABILITY_REQUIREMENTS: Record<
    DeeplinkType,
    DeeplinkCapabilityRequirement | null
> = {
    [DeeplinkType.TRANSFER]: { chain: 'send' },
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: { chain: 'send' },
    // Key registration signs and submits a transaction from the link's sender.
    [DeeplinkType.CHAIN_ACTION]: { chain: 'send' },
    [DeeplinkType.ASSET_OPT_IN]: { chain: 'manageAssets' },
    [DeeplinkType.ASSET_INBOX]: { chain: 'assetInbox' },
    [DeeplinkType.ADD_WATCH_ACCOUNT]: { chain: 'watchAccounts' },
    [DeeplinkType.SWAP]: { platform: 'swapTab', chain: 'swap' },
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: {
        platform: 'sharedAccounts',
        chain: 'multisig',
    },
    [DeeplinkType.BUY]: { platform: 'fundTab' },

    [DeeplinkType.DISCOVER_PATH]: {
        platform: 'discoverTab',
        anyChain: 'discover',
    },
    [DeeplinkType.STAKING]: { platform: 'staking', anyChain: 'staking' },
    [DeeplinkType.SIGN_REQUEST]: { anyChain: 'multisig' },
    [DeeplinkType.WALLET_CONNECT]: { anyChain: 'dappConnect' },
    [DeeplinkType.LIQUID_AUTH]: { anyChain: 'liquidAuth' },
    [DeeplinkType.PERA_WEB_IMPORT]: { anyChain: 'peraWebImport' },

    // The action sheet filters its own actions by the address's chain.
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
}

const REQUIREMENT_BY_TYPE: Partial<
    Record<AppDeeplink['type'], DeeplinkCapabilityRequirement | null>
> = DEEPLINK_CAPABILITY_REQUIREMENTS

/** The link's requirement with `chain` bound to the chain the link targets. */
export const capabilityRequirementForDeeplink = (
    link: AppDeeplink,
): CapabilityRequirement | null => {
    const requirement = REQUIREMENT_BY_TYPE[link.type]
    if (!requirement) return null
    const { platform, chain, anyChain } = requirement
    const target = 'target' in link ? link.target : undefined
    return {
        platform,
        anyChain,
        ...(chain &&
            target && {
                chain: { chainId: target.chainId, capability: chain },
            }),
    }
}
