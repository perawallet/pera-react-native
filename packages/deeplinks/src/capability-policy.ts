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

import type {
    ChainCapability,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { DeeplinkType, linkTargetOf, type AnyParsedDeeplink } from './links'

export type DeeplinkChainCapability =
    /** Checked on the chain the link targets. */
    | { chain: ChainCapability }
    /** Only for a type that names no chain; held when any chain has it. */
    | { anyChain: ChainCapability }

/**
 * The chain capability a deeplink needs before it may navigate: a deeplink
 * must never reach a screen its capability removed. `null` means none.
 *
 * Exhaustive `Record` like `DEEPLINK_NOTIFICATION_POLICY`: a new `DeeplinkType`
 * fails to compile until it is classified. An app layers its own route
 * capabilities on top.
 */
export const DEEPLINK_CHAIN_CAPABILITY: Record<
    DeeplinkType,
    Nullable<DeeplinkChainCapability>
> = {
    [DeeplinkType.TRANSFER]: { chain: 'send' },
    [DeeplinkType.RECEIVER_ACCOUNT_SELECTION]: { chain: 'send' },
    // Key registration signs and submits a transaction from the link's sender.
    [DeeplinkType.CHAIN_ACTION]: { chain: 'send' },
    [DeeplinkType.ASSET_OPT_IN]: { chain: 'manageAssets' },
    [DeeplinkType.ASSET_INBOX]: { chain: 'assetInbox' },
    [DeeplinkType.ADD_WATCH_ACCOUNT]: { chain: 'watchAccounts' },
    [DeeplinkType.SWAP]: { chain: 'swap' },
    [DeeplinkType.SHARED_ACCOUNT_IMPORT]: { chain: 'multisig' },

    [DeeplinkType.DISCOVER_PATH]: { anyChain: 'discover' },
    [DeeplinkType.STAKING]: { anyChain: 'staking' },
    [DeeplinkType.SIGN_REQUEST]: { anyChain: 'multisig' },
    [DeeplinkType.WALLET_CONNECT]: { anyChain: 'dappConnect' },
    [DeeplinkType.LIQUID_AUTH]: { anyChain: 'liquidAuth' },
    [DeeplinkType.PERA_WEB_IMPORT]: { anyChain: 'peraWebImport' },
    [DeeplinkType.PASSPHRASE_BACKUP]: { anyChain: 'mnemonicBackup' },
    // The app gates its inbox and notifications on the same capability.
    [DeeplinkType.INBOX]: { anyChain: 'notifications' },
    [DeeplinkType.NOTIFICATIONS]: { anyChain: 'notifications' },

    // The action sheet filters its own actions by the address's chain.
    [DeeplinkType.ADDRESS_ACTIONS]: null,
    [DeeplinkType.ADD_CONTACT]: null,
    [DeeplinkType.EDIT_CONTACT]: null,
    [DeeplinkType.RECOVER_ADDRESS]: null,
    [DeeplinkType.ASSET_DETAIL]: null,
    [DeeplinkType.ASSET_TRANSACTIONS]: null,
    [DeeplinkType.BUY]: null,
    [DeeplinkType.CARDS]: null,
    [DeeplinkType.SELL]: null,
    [DeeplinkType.ACCOUNT_DETAIL]: null,
    [DeeplinkType.INTERNAL_BROWSER]: null,
    [DeeplinkType.DISCOVER_BROWSER]: null,
    [DeeplinkType.HOME]: null,
    [DeeplinkType.PORTFOLIO]: null,
    [DeeplinkType.NFT_DETAIL]: null,
    [DeeplinkType.SCAN]: null,
    // Gated by the app's cloud backup flag hook, which folds in `cloudBackup`.
    [DeeplinkType.CLOUD_BACKUP]: null,
}

export type DeeplinkChainRequirement = {
    chain?: { chainId: ChainId; capability: ChainCapability }
    anyChain?: ChainCapability
}

/** The link's chain capability, bound to the chain the link targets. */
export const chainRequirementOf = (
    link: AnyParsedDeeplink,
): Nullable<DeeplinkChainRequirement> => {
    const requirement = DEEPLINK_CHAIN_CAPABILITY[link.type]
    if (!requirement) return null
    if ('anyChain' in requirement) return { anyChain: requirement.anyChain }
    const target = linkTargetOf(link)
    return target
        ? { chain: { chainId: target.chainId, capability: requirement.chain } }
        : null
}

/**
 * The link's chain when that chain's descriptor rules the link out, whatever
 * its capabilities say: an opt-in on a chain whose assets need none.
 */
export const unsupportedLinkChainOf = (
    link: AnyParsedDeeplink,
): Optional<ChainId> => {
    if (link.type !== DeeplinkType.ASSET_OPT_IN) return undefined
    const { chainId } = link.target
    const { chains } = getProvider()
    if (!chains.has(chainId)) return chainId
    return chains.get(chainId).descriptor.protocol.requiresAssetOptIn
        ? undefined
        : chainId
}
