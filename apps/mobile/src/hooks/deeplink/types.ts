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
    HOME: 'HOME',
    COINBASE_ASSET_TRANSFER: 'COINBASE_ASSET_TRANSFER',
} as const

export type DeeplinkType = (typeof DeeplinkType)[keyof typeof DeeplinkType]

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

export interface CoinbaseAssetTransferDeeplink extends ParsedDeeplink {
    type: typeof DeeplinkType.COINBASE_ASSET_TRANSFER
    assetId: string
    address: string
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
    | HomeDeeplink
    | CoinbaseAssetTransferDeeplink
