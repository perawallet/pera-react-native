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

export const DeeplinkType = {
    ADD_CONTACT: 'ADD_CONTACT',
    EDIT_CONTACT: 'EDIT_CONTACT',
    ADD_WATCH_ACCOUNT: 'ADD_WATCH_ACCOUNT',
    RECEIVER_ACCOUNT_SELECTION: 'RECEIVER_ACCOUNT_SELECTION',
    ADDRESS_ACTIONS: 'ADDRESS_ACTIONS',
    ALGO_TRANSFER: 'ALGO_TRANSFER',
    ASSET_TRANSFER: 'ASSET_TRANSFER',
    KEYREG: 'KEYREG',
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

/**
 * The locale tour's discriminant, declared as a type with deliberately no
 * runtime member above. Only the tour's own parser produces it and only the
 * tour's own handler reads it, and metro.config.js swaps both for stubs
 * outside dev builds — a `DeeplinkType` entry would keep the tag string alive
 * in release bundles after every module that could act on it is gone.
 */
export type DevLocaleTourDeeplinkType = 'DEV_LOCALE_TOUR'

export type DeeplinkType =
    | (typeof DeeplinkType)[keyof typeof DeeplinkType]
    | DevLocaleTourDeeplinkType

export interface ParsedDeeplink {
    type: DeeplinkType
    sourceUrl: string
}

export interface AddContactDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADD_CONTACT
    address: string
    label?: string
}

export interface EditContactDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.EDIT_CONTACT
    address: string
    label?: string
}

export interface AddWatchAccountDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADD_WATCH_ACCOUNT
    address: string
    label?: string
}

export interface ReceiverAccountSelectionDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.RECEIVER_ACCOUNT_SELECTION
    address: string
}

export interface AddressActionsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADDRESS_ACTIONS
    address: string
    label?: string
}

export interface AddressActionsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADDRESS_ACTIONS
    address: string
    label?: string
}

export interface AlgoTransferDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ALGO_TRANSFER
    receiverAddress: string
    amount?: string
    note?: string
    xnote?: string
    label?: string
}

export interface AssetTransferDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_TRANSFER
    assetId: string
    receiverAddress: string
    amount?: string
    note?: string
    xnote?: string
    label?: string
}

export interface KeyregDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.KEYREG
    senderAddress: string
    keyregType: string
    voteKey?: string
    selkey?: string
    sprfkey?: string
    votefst?: string
    votelst?: string
    votekd?: string
    fee?: string
    note?: string
    xnote?: string
}

export interface RecoverAddressDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.RECOVER_ADDRESS
    mnemonic: string
}

export interface WalletConnectDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.WALLET_CONNECT
    uri: string // Decoded WalletConnect URI
}

export interface AssetOptInDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_OPT_IN
    assetId: string
    address?: string
}

export interface AssetDetailDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_DETAIL
    address: string
    assetId: string
}

export interface AssetTransactionsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_TRANSACTIONS
    address: string
    assetId: string
}

export interface AssetInboxDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_INBOX
    address: string
}

export interface DiscoverBrowserDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.DISCOVER_BROWSER
    url: string // Decoded URL
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

export interface SwapDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.SWAP
    address?: string
    assetInId?: string
    assetOutId?: string
}

export interface BuyDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.BUY
    address?: string
}

export interface SellDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.SELL
    address?: string
}

export interface AccountDetailDeeplink extends ParsedDeeplink {
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

export interface SharedAccountImportDeeplink extends ParsedDeeplink {
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

/**
 * `perawallet://app/dev/locale-tour?locale=<tag>&step=<id>` drives one
 * screenshot-tour step; `?locale=<tag>&run=all` drives every step in the
 * default tour scope behind a single deeplink (see runTour.ts — one OS
 * confirmation dialog instead of 190). Exactly one of `step`/`run` is
 * present; the parser rejects a URL with neither. Dev-only; see
 * DevLocaleTourDeeplinkType above. Reuses the already-registered `perawallet`
 * scheme (`pera://` is not registered as an OS URL scheme in
 * app.config.builder.js).
 */
export interface DevLocaleTourDeeplink extends ParsedDeeplink {
    type: DevLocaleTourDeeplinkType
    locale: string
    step?: string
    run?: 'all'
}

export type AnyParsedDeeplink =
    | AddContactDeeplink
    | EditContactDeeplink
    | AddWatchAccountDeeplink
    | ReceiverAccountSelectionDeeplink
    | AddressActionsDeeplink
    | AlgoTransferDeeplink
    | AssetTransferDeeplink
    | KeyregDeeplink
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
    | DevLocaleTourDeeplink
