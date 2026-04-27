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

import { useCallback, useMemo } from 'react'
import { Linking } from 'react-native'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useRekeyToLedgerConfirmScreen } from './useRekeyToLedgerConfirmScreen'
import { useStyles } from './styles'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const LEARN_MORE_URL =
    'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/'

type SummaryRowProps = {
    account: WalletAccount | null
    styles: ReturnType<typeof useStyles>
}

const SummaryRow = ({ account, styles }: SummaryRowProps) => {
    if (!account) return null

    const truncated = truncateAlgorandAddress(account.address, 9)

    return (
        <PWView style={styles.accountRow}>
            <AccountIcon
                account={account}
                size='lg'
            />
            <PWView style={styles.accountText}>
                <PWText
                    variant='bodyLarge'
                    numberOfLines={1}
                >
                    {account.name ?? truncated}
                </PWText>
                {!!account.name && (
                    <PWText
                        variant='body'
                        style={styles.accountAddress}
                        numberOfLines={1}
                    >
                        {truncated}
                    </PWText>
                )}
            </PWView>
        </PWView>
    )
}

export const RekeyToLedgerConfirmScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        source,
        target,
        feeMicroAlgos,
        feePending,
        isSubmitting,
        handleConfirmPress,
    } = useRekeyToLedgerConfirmScreen()

    const feeAlgos = useMemo(() => {
        if (feeMicroAlgos === undefined) return undefined
        return microAlgosToAlgos(feeMicroAlgos)
    }, [feeMicroAlgos])

    const handleLearnMore = useCallback(() => {
        Linking.openURL(LEARN_MORE_URL)
    }, [])

    return (
        <PWView
            style={styles.container}
            testID='rekey-to-ledger-confirm-screen'
        >
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.header}>
                    <PWText variant='h1'>
                        {t('rekey.to_ledger.confirm.title')}
                    </PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.body}
                    >
                        {t('rekey.to_ledger.confirm.body')}{' '}
                        <PWText
                            variant='bodyLarge'
                            style={styles.learnMore}
                            onPress={handleLearnMore}
                        >
                            {t('rekey.to_ledger.confirm.learn_more')}
                        </PWText>
                    </PWText>
                </PWView>

                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t('rekey.to_ledger.confirm.summary_label')}
                    </PWText>

                    <PWView style={styles.summaryCard}>
                        <SummaryRow
                            account={source}
                            styles={styles}
                        />
                        <PWView style={styles.arrowRow}>
                            <PWIcon
                                name='arrow-down'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                        <SummaryRow
                            account={target}
                            styles={styles}
                        />
                    </PWView>
                </PWView>

                <PWView style={styles.spacer} />
            </PWScrollView>

            <PWView style={styles.footer}>
                <PWView style={styles.row}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.rowLabel}
                    >
                        {t('rekey.to_ledger.confirm.fee_label')}
                    </PWText>
                    <CurrencyDisplay
                        currency='ALGO'
                        value={feeAlgos}
                        precision={ALGO_ASSET.decimals}
                        minPrecision={3}
                        variant='bodyLarge'
                    />
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('rekey.to_ledger.confirm.cta')}
                    onPress={handleConfirmPress}
                    isLoading={isSubmitting}
                    isDisabled={!source || !target || feePending}
                    style={styles.cta}
                    testID='rekey-to-ledger-confirm-cta'
                />
            </PWView>
        </PWView>
    )
}
