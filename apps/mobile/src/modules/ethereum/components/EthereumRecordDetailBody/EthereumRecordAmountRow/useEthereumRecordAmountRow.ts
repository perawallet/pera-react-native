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

import { useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import type {
    BalanceChange,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { parseEvmNftAssetId } from '@perawallet/wallet-core-chain-ethereum'
import {
    baseUnitsToDisplayUnits,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import type { AssetAmountProps } from '@components/AssetAmount'
import { useLanguage } from '@hooks/useLanguage'

export type UseEthereumRecordAmountRowResult = {
    /** The NFT itself for an NFT leg, so several legs can be told apart; which way it moved otherwise. */
    title: string
    asset: AssetAmountProps['asset']
    /** Display units when the asset is known; the raw leg otherwise. */
    value: Decimal
    isLoading: boolean
    /** Off for an NFT, whose symbol is its collection's raw ticker, not a unit. */
    showSymbol: boolean
}

// A call that moves several assets lists each leg; "Amount" twice can't say
// which one left the account.
const amountTitleKeyOf = (value: Decimal) => {
    if (value.isNegative()) return 'transactions.record_detail.you_sent'
    if (value.isPositive()) return 'transactions.record_detail.you_received'
    return 'transactions.common.amount'
}

/**
 * The asset comes from the local store only, as in the list row: a page that
 * makes no node read of its own must not trigger one by naming a token. The
 * backend's symbol and decimals cover one the store doesn't hold.
 */
export const useEthereumRecordAmountRow = (
    change: BalanceChange,
    scope: ChainScope,
): UseEthereumRecordAmountRowResult => {
    const { t } = useLanguage()
    const { assetId } = change.assetRef
    const nft = useMemo(() => parseEvmNftAssetId(assetId), [assetId])
    const { data, isPending } = useAssetsQuery(scope, [assetId])
    const stored = data.get(assetId)

    return useMemo(() => {
        const known =
            stored ??
            (change.display && {
                assetId,
                unitName: change.display.symbol,
                decimals: change.display.decimals,
            })
        const collection =
            stored?.peraMetadata?.collectible?.collection?.name ||
            change.display?.symbol ||
            (nft ? truncateAlgorandAddress(nft.contract) : '')

        return {
            title: nft
                ? t('transactions.list_item.nft_subtitle', {
                      collection,
                      // A uint256 token id can run to 78 digits.
                      tokenId: truncateAlgorandAddress(nft.tokenId),
                  })
                : t(amountTitleKeyOf(change.value)),
            asset: known || undefined,
            value: known
                ? baseUnitsToDisplayUnits(change.value, known.decimals ?? 0)
                : change.value,
            isLoading: isPending,
            showSymbol: !nft,
        }
    }, [assetId, change, stored, nft, isPending, t])
}
