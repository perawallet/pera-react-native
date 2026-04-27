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
import { Trans } from 'react-i18next'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { getAccountDisplayName } from '@perawallet/wallet-core-accounts'
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
import { UndoRekeyWarningSheet } from '../../components/UndoRekeyWarningSheet'
import { useUndoRekeyConfirmScreen } from './useUndoRekeyConfirmScreen'
import { useStyles } from './styles'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const LEARN_MORE_URL =
    'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/'

type AccountStateRowProps = {
    account: WalletAccount
    showRekeyedIcon: boolean
    styles: ReturnType<typeof useStyles>
}

const AccountStateRow = ({
    account,
    showRekeyedIcon,
    styles,
}: AccountStateRowProps) => {
    const truncated = truncateAlgorandAddress(account.address, 9)

    return (
        <PWView style={styles.accountRow}>
            {showRekeyedIcon ? (
                <AccountIcon
                    account={account}
                    size='lg'
                />
            ) : (
                <PWIcon
                    name='wallet'
                    size='lg'
                    variant='primary'
                />
            )}
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

export const UndoRekeyConfirmScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        source,
        currentAuth,
        feeMicroAlgos,
        feePending,
        isSubmitting,
        isWarningOpen,
        handleContinuePress,
        handleWarningConfirm,
        handleWarningClose,
    } = useUndoRekeyConfirmScreen()

    const feeAlgos = useMemo(() => {
        if (feeMicroAlgos === undefined) return undefined
        return microAlgosToAlgos(feeMicroAlgos)
    }, [feeMicroAlgos])

    const handleLearnMore = useCallback(() => {
        Linking.openURL(LEARN_MORE_URL)
    }, [])

    if (!source) return null

    return (
        <PWView
            style={styles.container}
            testID='undo-rekey-confirm-screen'
        >
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.header}>
                    <PWText variant='h1'>
                        {t('rekey.undo.confirm.title')}
                    </PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.body}
                    >
                        <Trans
                            i18nKey='rekey.undo.confirm.body'
                            components={[
                                <PWText
                                    key='learn-more'
                                    variant='h4'
                                    style={styles.learnMore}
                                    onPress={handleLearnMore}
                                />,
                            ]}
                        />
                    </PWText>
                </PWView>

                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t('rekey.undo.confirm.summary_label')}
                    </PWText>

                    <PWView style={styles.summaryCard}>
                        <AccountStateRow
                            account={source}
                            showRekeyedIcon
                            styles={styles}
                        />
                        <PWView style={styles.arrowRow}>
                            <PWIcon
                                name='arrow-down'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                        <AccountStateRow
                            account={source}
                            showRekeyedIcon={false}
                            styles={styles}
                        />
                    </PWView>
                </PWView>

                <PWView style={styles.spacer} />
            </PWScrollView>

            <PWView style={styles.footer}>
                {currentAuth && (
                    <PWView style={styles.row}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t('rekey.undo.confirm.current_auth_label')}
                        </PWText>
                        <PWView style={styles.currentAuthValue}>
                            <AccountIcon
                                account={currentAuth}
                                size='sm'
                            />
                            <PWText
                                variant='bodyLarge'
                                numberOfLines={1}
                            >
                                {getAccountDisplayName(currentAuth)}
                            </PWText>
                        </PWView>
                    </PWView>
                )}
                <PWView style={styles.row}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.rowLabel}
                    >
                        {t('rekey.undo.confirm.fee_label')}
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
                    title={t('rekey.undo.confirm.cta')}
                    onPress={handleContinuePress}
                    isLoading={isSubmitting}
                    isDisabled={feePending}
                    style={styles.cta}
                    testID='undo-rekey-confirm-cta'
                />
            </PWView>

            <UndoRekeyWarningSheet
                isVisible={isWarningOpen}
                sourceName={getAccountDisplayName(source)}
                currentAuthName={
                    currentAuth ? getAccountDisplayName(currentAuth) : ''
                }
                onClose={handleWarningClose}
                onConfirm={handleWarningConfirm}
            />
        </PWView>
    )
}
