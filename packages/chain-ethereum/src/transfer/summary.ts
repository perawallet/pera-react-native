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

import { Decimal } from 'decimal.js'
import {
    type AssetRef,
    type LocalizedText,
    type TransactionSummary,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { areEvmAddressesEqual } from '../accounts/address-codec'

const SEND_TITLE_KEY = i18nKey('transactions.list_item.send')
const NFT_SUBTITLE_KEY = i18nKey('transactions.list_item.nft_subtitle')
const CANCEL_TITLE_KEY = i18nKey('transactions.list_item.cancel_transaction')

export const nftSendSubtitle = (
    collection: string,
    tokenId: string,
): LocalizedText => ({
    key: NFT_SUBTITLE_KEY,
    params: { collection, tokenId },
})

// The builder and the reviewer both describe a send through this, so a
// transfer the wallet builds reads the same once review rebuilds it from the bytes.
export const sendSummary = (
    kind: 'transfer' | 'token-transfer' | 'nft-transfer',
    from: string,
    to: string,
    amount: NonNullable<TransactionSummary['amount']>,
    subtitle?: LocalizedText,
): TransactionSummary => {
    const isSelf = areEvmAddressesEqual(from, to)
    return {
        kind,
        title: { key: SEND_TITLE_KEY },
        direction: isSelf ? 'self' : 'out',
        icon: isSelf ? 'self' : 'send',
        counterparty: to,
        ...(subtitle && { subtitle }),
        amount,
    }
}

/** A cancel is an empty transfer to the sender itself. */
export const cancelSummary = (
    from: string,
    nativeAsset: AssetRef,
): TransactionSummary => ({
    ...sendSummary('transfer', from, from, {
        assetRef: nativeAsset,
        value: new Decimal(0),
    }),
    title: { key: CANCEL_TITLE_KEY },
})
