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

import { useTheme } from '@rneui/themed'
import { PWDivider, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { TransactionIcon } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import type { DetailBodyProps } from '@modules/signing'
import { EthereumApprovalDetails } from '../EthereumApprovalDetails'
import { EthereumContractCallDetails } from '../EthereumContractCallDetails'
import { EthereumTransferAssetRows } from '../EthereumTransferAssetRows'
import { useEthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

export const EthereumTransactionDetailBody = ({
    transaction,
}: DetailBodyProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const presentation = useEthereumTransactionPresentation(transaction)

    if (!presentation) {
        return null
    }

    const {
        view,
        titleKey,
        iconName,
        counterparty,
        amount,
        isAmountLoading,
        maxFee,
        standardCall,
        isTransfer,
    } = presentation

    let callDetails
    if (standardCall && !isTransfer) {
        // The approval first, then the raw call it was read from.
        callDetails = (
            <>
                <EthereumApprovalDetails presentation={presentation} />
                <EthereumContractCallDetails presentation={presentation} />
            </>
        )
    } else if (!isTransfer) {
        callDetails = (
            <EthereumContractCallDetails presentation={presentation} />
        )
    } else {
        callDetails = (
            <>
                {!!counterparty && (
                    <KeyValueRow
                        testID='ethereum_detail_to'
                        title={t('transactions.common.to')}
                    >
                        <AddressDisplay
                            address={counterparty}
                            displayType='address-only'
                        />
                    </KeyValueRow>
                )}
                <EthereumTransferAssetRows
                    presentation={presentation}
                    testIDPrefix='ethereum_detail'
                />
                {(!!amount || isAmountLoading) && (
                    <KeyValueRow
                        testID='ethereum_detail_amount'
                        title={t('transactions.common.amount')}
                    >
                        <AssetAmount
                            asset={amount?.asset}
                            value={amount?.value}
                            isLoading={isAmountLoading}
                            showSymbol
                            ignorePrivacyMode
                        />
                    </KeyValueRow>
                )}
            </>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <TransactionIcon
                    size='md'
                    name={iconName}
                />
                <PWText
                    style={styles.title}
                    truncate
                >
                    {t(titleKey)}
                </PWText>
            </PWView>

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                <KeyValueRow
                    testID='ethereum_detail_from'
                    title={t('transactions.common.from')}
                >
                    <AddressDisplay
                        address={view.from}
                        displayType='address-only'
                    />
                </KeyValueRow>

                {callDetails}

                <KeyValueRow
                    testID='ethereum_max_fee'
                    title={t('send_funds.fee.max_fee')}
                >
                    {maxFee ? (
                        <AssetAmount
                            asset={maxFee.asset}
                            value={maxFee.value}
                            showSymbol
                            ignorePrivacyMode
                        />
                    ) : (
                        <PWText>{t('ethereum.batch.fee_when_reached')}</PWText>
                    )}
                </KeyValueRow>
            </PWView>
        </PWView>
    )
}
