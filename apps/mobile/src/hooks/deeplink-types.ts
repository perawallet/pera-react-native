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

/**
 * All supported deeplink types based on deeplink_formats.csv
 * Using 'as const' pattern for better type safety and maintainability
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
    WEB_IMPORT: 'WEB_IMPORT',
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
    HOME: 'HOME',
    COINBASE_ASSET_TRANSFER: 'COINBASE_ASSET_TRANSFER',
} as const

export type DeeplinkType = typeof DeeplinkType[keyof typeof DeeplinkType]

/**
 * Base interface for all parsed deeplinks
 */
export interface ParsedDeeplink {
    type: DeeplinkType
    sourceUrl: string
}

/**
 * Add Contact deeplink
 * Format: add-contact/?address=$ADDRESS&label=$LABEL
 */
export interface AddContactDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADD_CONTACT
    address: string
    label?: string
}

/**
 * Edit Contact deeplink
 * Format: edit-contact/?address=$ADDRESS&label=$LABEL
 */
export interface EditContactDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.EDIT_CONTACT
    address: string
    label?: string
}

/**
 * Add Watch Account deeplink
 * Format: register-watch-account/?address=$ADDRESS&label=$LABEL
 */
export interface AddWatchAccountDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADD_WATCH_ACCOUNT
    address: string
    label?: string
}

/**
 * Receiver Account Selection deeplink
 * Format: receiver-account-selection/?address=$ADDRESS
 */
export interface ReceiverAccountSelectionDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.RECEIVER_ACCOUNT_SELECTION
    address: string
}

/**
 * Address Actions deeplink
 * Format: address-actions/?address=$ADDRESS&label=$LABEL
 */
export interface AddressActionsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ADDRESS_ACTIONS
    address: string
    label?: string
}

/**
 * ALGO Transfer deeplink (assetId=0)
 * Format: asset-transfer/?assetId=0&receiverAddress=$ADDRESS&amount=$AMOUNT&note=$NOTE&xnote=$XNOTE&label=$LABEL
 */
export interface AlgoTransferDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ALGO_TRANSFER
    receiverAddress: string
    amount?: string
    note?: string
    xnote?: string
    label?: string
}

/**
 * Asset Transfer deeplink
 * Format: asset-transfer/?assetId=$ASSET_ID&receiverAddress=$ADDRESS&amount=$AMOUNT&note=$NOTE&xnote=$XNOTE&label=$LABEL
 */
export interface AssetTransferDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_TRANSFER
    assetId: string
    receiverAddress: string
    amount?: string
    note?: string
    xnote?: string
    label?: string
}

/**
 * Keyreg (Key Registration) deeplink
 * Format: keyreg/?senderAddress=$ADDRESS&type=$TYPE&voteKey=$VOTE_KEY&selkey=$SELKEY&sprfkey=$SPFRKEY&votefst=$VOTEFST&votelst=$VOTELST&votekd=$VOTEKD&fee=$FEE&note=$NOTE&xnote=XNOTE
 */
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

/**
 * Recover Address deeplink
 * Format: recover-address/?mnemonic=$MNEMONIC
 */
export interface RecoverAddressDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.RECOVER_ADDRESS
    mnemonic: string
}

/**
 * Web Import deeplink
 * Format: web-import/?backupId=$BACKUP_ID&encryptionKey=$ENCRYPTION_KEY&action=$ACTION&version=$VERSION&platform=$PLATFORM&modificationKey=$MODIFICATION_KEY
 */
export interface WebImportDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.WEB_IMPORT
    backupId: string
    encryptionKey: string
    action: string
    version?: string
    platform?: string
    modificationKey?: string
}

/**
 * WalletConnect deeplink
 * Format: wallet-connect/?uri=$URI (base64 encoded) or wc:$ID@1?bridge=$BRIDGE&key=$KEY
 */
export interface WalletConnectDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.WALLET_CONNECT
    uri: string // Decoded WalletConnect URI
}

/**
 * Asset Opt-in deeplink
 * Format: asset-opt-in/?address=$ADDRESS&assetId=$ASSET_ID
 */
export interface AssetOptInDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_OPT_IN
    assetId: string
    address?: string
}

/**
 * Asset Detail deeplink
 * Format: asset-detail/?address=$ADDRESS&assetId=$ASSET_ID
 */
export interface AssetDetailDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_DETAIL
    address: string
    assetId: string
}

/**
 * Asset Transactions deeplink
 * Format: asset-detail/?address=$ADDRESS&assetId=$ASSET_ID (from notifications with type=asset/transactions)
 */
export interface AssetTransactionsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_TRANSACTIONS
    address: string
    assetId: string
}

/**
 * Asset Inbox deeplink
 * Format: asset-inbox/?address=$ADDRESS
 */
export interface AssetInboxDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ASSET_INBOX
    address: string
}

/**
 * Discover Browser deeplink
 * Format: discover-browser/?url=$URL (base64 encoded)
 */
export interface DiscoverBrowserDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.DISCOVER_BROWSER
    url: string // Decoded URL
}

/**
 * Discover Path deeplink
 * Format: discover-path/?path=$PATH or discover?path=$PATH
 */
export interface DiscoverPathDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.DISCOVER_PATH
    path?: string
}

/**
 * Cards deeplink
 * Format: cards-path/?path=$PATH or cards?path=$PATH
 */
export interface CardsDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.CARDS
    path: string
}

/**
 * Staking deeplink
 * Format: staking-path/?path=$PATH or staking?path=$PATH
 */
export interface StakingDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.STAKING
    path?: string
}

/**
 * Swap deeplink
 * Format: swap/?address=$ADDRESS&assetInId=$ASSET_IN_ID&assetOutId=$ASSET_OUT_ID
 */
export interface SwapDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.SWAP
    address?: string
    assetInId?: string
    assetOutId?: string
}

/**
 * Buy deeplink
 * Format: buy/?address=$ADDRESS
 */
export interface BuyDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.BUY
    address?: string
}

/**
 * Sell deeplink
 * Format: sell/?address=$ADDRESS
 */
export interface SellDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.SELL
    address?: string
}

/**
 * Account Detail deeplink
 * Format: account-detail/?address=$ADDRESS
 */
export interface AccountDetailDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.ACCOUNT_DETAIL
    address: string
}

/**
 * Internal Browser deeplink
 * Format: internal-browser/?url=$URL (base64 encoded)
 */
export interface InternalBrowserDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.INTERNAL_BROWSER
    url: string // Decoded URL
}

/**
 * Home deeplink
 * Format: / or ?any=$any (fallback to home)
 */
export interface HomeDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.HOME
}

/**
 * Coinbase Asset Transfer deeplink
 * Format: algo:ASSET_ID/transfer?address=$ADDRESS
 */
export interface CoinbaseAssetTransferDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.COINBASE_ASSET_TRANSFER
    assetId: string
    address: string
}

/**
 * Union type of all possible parsed deeplinks
 */
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
    | WebImportDeeplink
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
    | HomeDeeplink
    | CoinbaseAssetTransferDeeplink
