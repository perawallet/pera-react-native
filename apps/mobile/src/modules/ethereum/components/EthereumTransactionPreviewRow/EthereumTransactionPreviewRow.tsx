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
import { TransactionIcon } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import type { PreviewRowProps } from '@modules/signing'
import { useEthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

export const EthereumTransactionPreviewRow = ({
    transaction,
    onPress,
}: PreviewRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const presentation = useEthereumTransactionPresentation(transaction)

    if (!presentation) {
        return null
    }

    const { titleKey, iconName, counterparty } = presentation

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
                    {t(titleKey)}
                </PWText>
                {!!counterparty && (
                    <AddressDisplay
                        address={counterparty}
                        displayType='address-only'
                        showCopy={false}
                        textProps={{
                            variant: 'caption',
                            style: styles.counterparty,
                        }}
                    />
                )}
            </PWView>
            <PWIcon
                name='chevron-right'
                size='sm'
            />
        </PWTouchableOpacity>
    )
}
