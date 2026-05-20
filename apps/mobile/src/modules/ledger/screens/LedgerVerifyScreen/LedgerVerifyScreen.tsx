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

import { SafeAreaView } from 'react-native-safe-area-context'
import {
    PWView,
    PWText,
    PWIcon,
    PWButton,
    PWScrollView,
    PWResultView,
} from '@components/core'

import { useStyles } from './styles'
import { useLedgerVerifyScreen } from './useLedgerVerifyScreen'
import { LedgerVerificationCard } from './LedgerVerificationCard'

export const LedgerVerifyScreen = () => {
    const styles = useStyles()
    const {
        selectedAccounts,
        verifyTargets,
        verifiedIndices,
        areAllVerified,
        errorPreset,
        handleAdd,
        handleRetry,
        handleTroubleshoot,
        t,
    } = useLedgerVerifyScreen()

    if (errorPreset) {
        return (
            <PWResultView
                variant='error'
                title={errorPreset.title}
                body={errorPreset.body}
                primaryAction={{
                    label: t('ledger.errors.retry'),
                    onPress: handleRetry,
                }}
                secondaryAction={{
                    label: t('ledger.errors.troubleshoot'),
                    onPress: handleTroubleshoot,
                }}
                testID='ledger-verify-error'
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.heroIcon}>
                    <PWIcon
                        name='ledger'
                        size='xl'
                    />
                </PWView>

                <PWText
                    variant='h2'
                    style={styles.title}
                >
                    {t('ledger.verify.title')}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('ledger.verify.description')}
                </PWText>

                <PWView style={styles.cardList}>
                    {verifyTargets.map((acc, i) => (
                        <LedgerVerificationCard
                            key={acc.address}
                            address={acc.address}
                            status={
                                verifiedIndices.has(i) ? 'verified' : 'awaiting'
                            }
                            testID={`ledger_verify_card_${i}`}
                        />
                    ))}
                </PWView>
            </PWScrollView>

            <SafeAreaView
                edges={['bottom']}
                style={styles.footer}
            >
                <PWButton
                    testID='ledger_verify_add_accounts_button'
                    title={t('ledger.verify.add_accounts', {
                        count: selectedAccounts.length,
                    })}
                    onPress={handleAdd}
                    variant='primary'
                    isDisabled={!areAllVerified}
                />
            </SafeAreaView>
        </PWView>
    )
}
