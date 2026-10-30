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

import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import type {
    BalanceChange,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { baseUnitsToDisplayUnits } from '@perawallet/wallet-core-shared'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'

type EthereumRecordAmountRowProps = {
    change: BalanceChange
    scope: ChainScope
    testID: string
}

/**
 * The asset comes from the local store only, as in the list row: a page that
 * makes no node read of its own must not trigger one by naming a token. The
 * backend's symbol and decimals cover one the store doesn't hold.
 */
export const EthereumRecordAmountRow = ({
    change,
    scope,
    testID,
}: EthereumRecordAmountRowProps) => {
    const { t } = useLanguage()
    const { assetId } = change.assetRef
    const { data, isPending } = useAssetsQuery(scope, [assetId])
    const stored = data.get(assetId)
    const known =
        stored ??
        (change.display && {
            assetId,
            unitName: change.display.symbol,
            decimals: change.display.decimals,
        })

    return (
        <KeyValueRow
            testID={testID}
            title={t('transactions.common.amount')}
        >
            <AssetAmount
                asset={known || undefined}
                value={
                    known
                        ? baseUnitsToDisplayUnits(
                              change.value,
                              known.decimals ?? 0,
                          )
                        : change.value
                }
                isLoading={isPending}
                showSymbol
                ignorePrivacyMode
            />
        </KeyValueRow>
    )
}
