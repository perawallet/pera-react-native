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

import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetIcon } from '@components/AssetIcon'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

type EthereumTransferAssetRowsProps = {
    presentation: EthereumTransactionPresentation
    testIDPrefix: 'ethereum_review' | 'ethereum_detail'
}

export const EthereumTransferAssetRows = ({
    presentation,
    testIDPrefix,
}: EthereumTransferAssetRowsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { view, amount, collectible, standardCall, sender, nftItems } =
        presentation
    const tokenContract =
        view.token?.contract ??
        (standardCall?.kind === 'token-transfer'
            ? standardCall.contract
            : undefined)
    const nftContract =
        view.nft?.contract ??
        (standardCall?.kind === 'nft-transfer'
            ? standardCall.contract
            : undefined)

    const senderRow = sender ? (
        <KeyValueRow
            testID={`${testIDPrefix}_sender`}
            title={t('transactions.common.from')}
        >
            <AddressDisplay
                address={sender}
                displayType='address-only'
            />
        </KeyValueRow>
    ) : null

    if (tokenContract) {
        return (
            <>
                {senderRow}
                <KeyValueRow
                    testID={`${testIDPrefix}_asset`}
                    title={t('transactions.common.asset')}
                >
                    <PWView style={styles.asset}>
                        {!!amount?.asset && (
                            <PWText>{amount.asset.unitName}</PWText>
                        )}
                        <AddressDisplay
                            address={tokenContract}
                            displayType='address-only'
                        />
                    </PWView>
                </KeyValueRow>
            </>
        )
    }

    if (nftContract && collectible) {
        return (
            <>
                {senderRow}
                <KeyValueRow
                    testID={`${testIDPrefix}_nft`}
                    title={t('transactions.common.asset')}
                >
                    <PWView style={styles.nft}>
                        {!!amount?.asset && (
                            <AssetIcon
                                asset={amount.asset}
                                shape='square'
                                size='xl'
                            />
                        )}
                        <PWView style={styles.asset}>
                            <PWText>
                                {t('transactions.list_item.nft_subtitle', {
                                    collection:
                                        collectible.collectionName ??
                                        nftContract,
                                    tokenId: collectible.tokenId,
                                })}
                            </PWText>
                            <AddressDisplay
                                address={nftContract}
                                displayType='address-only'
                            />
                        </PWView>
                    </PWView>
                </KeyValueRow>
            </>
        )
    }

    if (nftContract && nftItems) {
        const collection =
            standardCall?.kind === 'nft-transfer'
                ? (standardCall.collectionName ?? nftContract)
                : nftContract
        return (
            <>
                {senderRow}
                <KeyValueRow
                    testID={`${testIDPrefix}_nft_collection`}
                    title={t('signing.collection_approval.collection_label')}
                >
                    <AddressDisplay
                        address={nftContract}
                        displayType='address-only'
                    />
                </KeyValueRow>
                {nftItems.map((item, index) => (
                    <KeyValueRow
                        // ERC-1155 lets a batch name the same id twice.
                        key={index}
                        testID={`${testIDPrefix}_nft_item_${index}`}
                        title={t('transactions.list_item.nft_subtitle', {
                            collection,
                            tokenId: item.tokenId,
                        })}
                    >
                        <AssetAmount
                            asset={null}
                            value={item.amount}
                            ignorePrivacyMode
                        />
                    </KeyValueRow>
                ))}
            </>
        )
    }

    return senderRow
}
