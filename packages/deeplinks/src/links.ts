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

import type { Decimal } from 'decimal.js'
import type {
    AssetRef,
    ChainActionData,
    ChainPaymentData,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { ChainLinkTarget } from './models'

export const DeeplinkType = {
    ADD_CONTACT: 'ADD_CONTACT',
    EDIT_CONTACT: 'EDIT_CONTACT',
    ADD_WATCH_ACCOUNT: 'ADD_WATCH_ACCOUNT',
    RECEIVER_ACCOUNT_SELECTION: 'RECEIVER_ACCOUNT_SELECTION',
    ADDRESS_ACTIONS: 'ADDRESS_ACTIONS',
    TRANSFER: 'TRANSFER',
    CHAIN_ACTION: 'CHAIN_ACTION',
    RECOVER_ADDRESS: 'RECOVER_ADDRESS',
    WALLET_CONNECT: 'WALLET_CONNECT',
    ASSET_OPT_IN: 'ASSET_OPT_IN',
    ASSET_DETAIL: 'ASSET_DETAIL',
    ASSET_TRANSACTIONS: 'ASSET_TRANSACTIONS',
    ASSET_INBOX: 'ASSET_INBOX',
    DISCOVER_BROWSER: 'DISCOVER_BROWSER',
    DISCOVER_PATH: 'DISCOVER_PATH',
    CARDS: 'CARDS',
    STAKING: 'STAKING',
    SWAP: 'SWAP',
    BUY: 'BUY',
    SELL: 'SELL',
    ACCOUNT_DETAIL: 'ACCOUNT_DETAIL',
    INTERNAL_BROWSER: 'INTERNAL_BROWSER',
    SHARED_ACCOUNT_IMPORT: 'SHARED_ACCOUNT_IMPORT',
    SIGN_REQUEST: 'SIGN_REQUEST',
    PERA_WEB_IMPORT: 'PERA_WEB_IMPORT',
    LIQUID_AUTH: 'LIQUID_AUTH',
    HOME: 'HOME',
} as const

export type DeeplinkType = (typeof DeeplinkType)[keyof typeof DeeplinkType]

/**
 * Where a link entered the app. 'deeplink' means the OS Linking layer only
 * (a real external deep link, e.g. from a mobile browser) — webview-initiated
 * navigations must use 'in-app' and push-notification taps 'notification',
 * so handlers keyed on 'deeplink' (return-to-dapp, pairing overlay) never
 * fire for links that originated inside the app.
 */
export type LinkSource = 'qr' | 'deeplink' | 'in-app' | 'notification'

export interface ParsedDeeplink {
    type: DeeplinkType
    sourceUrl: string
}

/** A link whose addresses and asset ids belong to one chain. */
export interface ChainScopedDeeplink extends ParsedDeeplink {
    target: ChainLinkTarget
}

export interface AddContactDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ADD_CONTACT
    address: string
    label?: string
}

export interface EditContactDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.EDIT_CONTACT
    address: string
    label?: string
}

export interface AddWatchAccountDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ADD_WATCH_ACCOUNT
    address: string
    label?: string
}

export interface ReceiverAccountSelectionDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.RECEIVER_ACCOUNT_SELECTION
    address: string
}

export interface AddressActionsDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ADDRESS_ACTIONS
    address: string
    label?: string
}

export interface TransferDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.TRANSFER
    receiverAddress: string
    /** Absent: the target chain's native asset. */
    assetRef?: AssetRef
    /** Base units of the asset. */
    amount?: Decimal
    note?: string
    label?: string
    chainData?: ChainPaymentData
}

export interface ChainActionDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.CHAIN_ACTION
    chainData: ChainActionData
}

export interface RecoverAddressDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.RECOVER_ADDRESS
    mnemonic: string
}

export interface WalletConnectDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.WALLET_CONNECT
    uri: string // Decoded WalletConnect URI
    /**
     * Present only when the iOS `@perawallet/connect` wrapper
     * (`perawallet-wc://wc?uri=...&browser=<name>`) named the initiating
     * mobile browser. Android sends the raw wc: URI with no wrapper.
     */
    browserName?: string
}

export interface AssetOptInDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ASSET_OPT_IN
    assetRef: AssetRef
    address?: string
}

export interface AssetDetailDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ASSET_DETAIL
    address: string
    assetRef: AssetRef
}

export interface AssetTransactionsDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ASSET_TRANSACTIONS
    address: string
    /** Absent: the target chain's native asset. */
    assetRef?: AssetRef
}

export interface AssetInboxDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ASSET_INBOX
    address: string
}

export interface DiscoverBrowserDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.DISCOVER_BROWSER
    url: string // Decoded URL
    /** Set only for a chain explorer link. */
    target?: ChainLinkTarget
}

export interface DiscoverPathDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.DISCOVER_PATH
    path?: string
}

export interface CardsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.CARDS
    path: string
}

export interface StakingDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.STAKING
    path?: string
}

export interface SwapDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.SWAP
    address?: string
    assetInRef?: AssetRef
    assetOutRef?: AssetRef
}

export interface BuyDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.BUY
    address?: string
}

export interface SellDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.SELL
    address?: string
}

export interface AccountDetailDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.ACCOUNT_DETAIL
    address: string
}

export interface InternalBrowserDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.INTERNAL_BROWSER
    url: string // Decoded URL
}

export interface HomeDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.HOME
}

export interface SharedAccountImportDeeplink extends ChainScopedDeeplink {
    type: typeof DeeplinkType.SHARED_ACCOUNT_IMPORT
    address: string
}

export interface SignRequestDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.SIGN_REQUEST
    signRequestId: string
}

export interface PeraWebImportDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.PERA_WEB_IMPORT
    /** Server-side id of the encrypted backup row. */
    backupId: string
    /** 32-byte secretbox key, already decoded from the on-wire encoding. */
    encryptionKey: Uint8Array
}

/**
 * A scanned/inbound Liquid Auth URL.
 *
 * - `variant: 'fido'`   — A `fido://…` URL. The handler hands the URL back
 *                        to the OS via Linking, which routes it to the
 *                        registered credential provider extension.
 * - `variant: 'liquid'` — A `liquid://…` URL for the Liquid Auth comms
 *                        protocol. Recognised by the parser today; the
 *                        protocol-side dispatch lands later.
 */
export interface LiquidAuthDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.LIQUID_AUTH
    variant: 'fido' | 'liquid'
    /** Original URL as scanned, preserved for system Linking and logging. */
    url: string
}

export type AnyParsedDeeplink =
    | AddContactDeeplink
    | EditContactDeeplink
    | AddWatchAccountDeeplink
    | ReceiverAccountSelectionDeeplink
    | AddressActionsDeeplink
    | TransferDeeplink
    | ChainActionDeeplink
    | RecoverAddressDeeplink
    | WalletConnectDeeplink
    | AssetOptInDeeplink
    | AssetDetailDeeplink
    | AssetTransactionsDeeplink
    | AssetInboxDeeplink
    | DiscoverBrowserDeeplink
    | DiscoverPathDeeplink
    | CardsDeeplink
    | StakingDeeplink
    | SwapDeeplink
    | BuyDeeplink
    | SellDeeplink
    | AccountDetailDeeplink
    | InternalBrowserDeeplink
    | SharedAccountImportDeeplink
    | SignRequestDeeplink
    | PeraWebImportDeeplink
    | LiquidAuthDeeplink
    | HomeDeeplink

export const linkTargetOf = (
    link: AnyParsedDeeplink,
): Optional<ChainLinkTarget> => ('target' in link ? link.target : undefined)
