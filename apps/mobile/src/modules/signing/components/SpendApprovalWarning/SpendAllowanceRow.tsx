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
    ChainScope,
    SpendAllowance,
} from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useBaseUnitsAmount } from '@hooks/useBaseUnitsAmount'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type SpendAllowanceRowProps = {
    allowance: SpendAllowance
    scope: ChainScope
    index: number
}

export const SpendAllowanceRow = ({
    allowance,
    scope,
    index,
}: SpendAllowanceRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { asset, value, isLoading } = useBaseUnitsAmount(
        allowance.assetRef.assetId,
        allowance.amount,
        scope,
    )
    const { nft } = allowance

    return (
        <>
            <KeyValueRow
                testID={`message-signing-spend-approval-asset-${index}`}
                title={t('transactions.common.asset')}
            >
                <PWView style={styles.asset}>
                    {nft ? (
                        <PWText>
                            {t('transactions.list_item.nft_subtitle', {
                                collection:
                                    asset?.peraMetadata?.collectible?.collection
                                        ?.name ?? nft.collection,
                                tokenId: nft.tokenId,
                            })}
                        </PWText>
                    ) : (
                        !!asset && <PWText>{asset.unitName}</PWText>
                    )}
                    <AddressDisplay
                        address={nft?.collection ?? allowance.assetRef.assetId}
                        displayType='address-only'
                    />
                </PWView>
            </KeyValueRow>
            {!nft && (
                <KeyValueRow
                    testID={`message-signing-spend-approval-amount-${index}`}
                    title={t('transactions.common.amount')}
                >
                    {allowance.amount === undefined ? (
                        <PWText>{t('signing.spend_approval.unlimited')}</PWText>
                    ) : (
                        <AssetAmount
                            chainId={scope.chainId}
                            asset={asset}
                            value={value}
                            isLoading={isLoading}
                            showSymbol
                            ignorePrivacyMode
                        />
                    )}
                </KeyValueRow>
            )}
        </>
    )
}
