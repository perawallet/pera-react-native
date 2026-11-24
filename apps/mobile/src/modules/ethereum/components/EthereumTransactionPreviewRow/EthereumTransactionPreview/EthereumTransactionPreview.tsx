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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { TransactionIcon } from '@components/TransactionIcon'
import type { EthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import { useEthereumTransactionPreview } from './useEthereumTransactionPreview'
import { useStyles } from './styles'

type EthereumTransactionPreviewProps = {
    presentation: EthereumTransactionPresentation
    onPress?: () => void
}

export const EthereumTransactionPreview = ({
    presentation,
    onPress,
}: EthereumTransactionPreviewProps) => {
    const styles = useStyles()
    const { title, detail } = useEthereumTransactionPreview(presentation)
    const { iconName, counterparty, scope } = presentation

    return (
        <PWTouchableOpacity
            testID='transaction_preview_row'
            style={styles.container}
            onPress={onPress}
        >
            <TransactionIcon
                name={iconName}
                size='sm'
            />
            <PWView style={styles.content}>
                <PWText
                    truncate
                    style={styles.title}
                >
                    {title}
                </PWText>
                {!!counterparty && (
                    <AddressDisplay
                        address={counterparty}
                        displayType='address-only'
                        scope={scope}
                        showCopy={false}
                        textProps={{
                            variant: 'caption',
                            style: styles.counterparty,
                        }}
                    />
                )}
                {detail?.kind === 'amount' && (
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={detail.asset}
                        value={detail.value}
                        density='compact'
                        showSymbol
                        variant='caption'
                        style={styles.detail}
                        numberOfLines={1}
                        ignorePrivacyMode
                        testID='transaction_preview_amount'
                    />
                )}
                {detail?.kind === 'label' && (
                    <PWView style={styles.labelRow}>
                        {detail.isWarning && (
                            <PWIcon
                                name='warning'
                                size='xs'
                                variant='warning'
                                testID='transaction_preview_warning'
                            />
                        )}
                        <PWText
                            variant='caption'
                            truncate
                            style={
                                detail.isWarning
                                    ? styles.warningDetail
                                    : styles.detail
                            }
                            testID='transaction_preview_amount'
                        >
                            {detail.label}
                        </PWText>
                    </PWView>
                )}
            </PWView>
            <PWIcon
                name='chevron-right'
                size='sm'
            />
        </PWTouchableOpacity>
    )
}
