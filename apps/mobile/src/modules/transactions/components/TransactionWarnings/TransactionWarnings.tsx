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

import {
    PWBottomSheet,
    PWDivider,
    PWIcon,
    PWRoundIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import {
    encodeAlgorandAddress,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useModalState } from '@hooks/useModalState'
import { useMemo } from 'react'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useTheme } from '@rneui/themed'
import { LONG_ADDRESS_FORMAT } from '@constants/ui'
import { PanelButton } from '@components/PanelButton'

export type TransactionWarningsProps = {
    transaction: PeraDisplayableTransaction
}

export const TransactionWarnings = ({
    transaction,
}: TransactionWarningsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { theme } = useTheme()

    const { isOpen, open, close } = useModalState()

    const closeAddress = useMemo(() => {
        return (
            transaction.paymentTransaction?.closeRemainderTo ??
            transaction.assetTransferTransaction?.closeTo
        )
    }, [transaction])

    const rekeyAddress = useMemo(() => {
        return transaction.rekeyTo?.publicKey
            ? encodeAlgorandAddress(transaction.rekeyTo.publicKey)
            : undefined
    }, [transaction])

    const warningCount = useMemo(() => {
        return (closeAddress ? 1 : 0) + (rekeyAddress ? 1 : 0)
    }, [transaction])

    if (!warningCount) {
        return null
    }

    return (
        <>
            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />
            <PWView style={styles.warningContainer}>
                <PanelButton
                    onPress={open}
                    title={t('transactions.warning.title')}
                    titleWeight='h4'
                    description={t('transactions.warning.title_cta', {
                        count: warningCount,
                    })}
                    leftIcon='info'
                    rightIcon='chevron-right'
                    variant='error'
                />

                <PWBottomSheet isVisible={isOpen}>
                    <PWView style={styles.sheetContainer}>
                        <PWToolbar
                            left={
                                <PWIcon
                                    name='cross'
                                    variant='secondary'
                                    onPress={close}
                                />
                            }
                            center={
                                <PWText variant='h4'>
                                    {t('transactions.warning.title', {
                                        count: warningCount,
                                    })}
                                </PWText>
                            }
                        />

                        {!!closeAddress && (
                            <PWView style={styles.warningSection}>
                                <PWView
                                    style={styles.warningSectionIconContainer}
                                >
                                    <PWRoundIcon
                                        icon='trash'
                                        size='md'
                                        variant='secondary'
                                    />
                                    <PWText style={styles.warningMessage}>
                                        {t(
                                            'transactions.warning.close_warning',
                                            {
                                                address:
                                                    truncateAlgorandAddress(
                                                        closeAddress,
                                                        LONG_ADDRESS_FORMAT,
                                                    ),
                                            },
                                        )}
                                    </PWText>
                                </PWView>
                            </PWView>
                        )}
                        {!!rekeyAddress && (
                            <PWDivider
                                style={styles.divider}
                                color={theme.colors.layerGray}
                            />
                        )}

                        {!!rekeyAddress && (
                            <PWView style={styles.warningSection}>
                                <PWView
                                    style={styles.warningSectionIconContainer}
                                >
                                    <PWRoundIcon
                                        icon='rekey'
                                        size='md'
                                        variant='secondary'
                                    />
                                    <PWView
                                        style={styles.warningMessageContainer}
                                    >
                                        <PWText style={styles.warningMessage}>
                                            {t(
                                                'transactions.warning.rekey_warning',
                                                {
                                                    address:
                                                        truncateAlgorandAddress(
                                                            rekeyAddress,
                                                            LONG_ADDRESS_FORMAT,
                                                        ),
                                                },
                                            )}
                                        </PWText>
                                        <PWText variant='h4'>
                                            {t(
                                                'transactions.warning.rekey_warning_bold',
                                            )}
                                        </PWText>
                                    </PWView>
                                </PWView>
                            </PWView>
                        )}
                    </PWView>
                </PWBottomSheet>
            </PWView>
        </>
    )
}
