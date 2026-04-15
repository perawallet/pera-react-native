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

import React from 'react'
import { ActivityIndicator } from 'react-native'
import { PWView, PWText, PWIcon, PWResultScreen } from '@components/core'

import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLedgerVerifyScreen } from './useLedgerVerifyScreen'

export const LedgerVerifyScreen = () => {
    const styles = useStyles()
    const {
        verificationState,
        currentIndex,
        totalAccounts,
        currentAddress,
        errorPreset,
        handleRetry,
        handleTroubleshoot,
        t,
    } = useLedgerVerifyScreen()

    if (errorPreset) {
        return (
            <PWResultScreen
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

    const isLoading =
        verificationState === 'connecting' || verificationState === 'verifying'

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                {isLoading && (
                    <>
                        <ActivityIndicator size='large' />
                        <PWText
                            variant='h2'
                            style={styles.title}
                        >
                            {verificationState === 'connecting'
                                ? t('ledger.verify.connecting')
                                : t('ledger.verify.verify_on_device')}
                        </PWText>

                        {verificationState === 'verifying' && (
                            <>
                                <PWText
                                    variant='body'
                                    style={styles.progressText}
                                >
                                    {t('ledger.verify.progress', {
                                        current: currentIndex + 1,
                                        total: totalAccounts,
                                    })}
                                </PWText>

                                {currentAddress !== null && (
                                    <PWText
                                        variant='caption'
                                        style={styles.addressText}
                                    >
                                        {truncateAlgorandAddress(
                                            currentAddress,
                                            13,
                                        )}
                                    </PWText>
                                )}

                                <PWText
                                    variant='body'
                                    style={styles.instructionText}
                                >
                                    {t('ledger.verify.confirm_instruction')}
                                </PWText>
                            </>
                        )}
                    </>
                )}

                {verificationState === 'complete' && (
                    <>
                        <PWIcon
                            name='check'
                            size='xxl'
                        />
                        <PWText
                            variant='h2'
                            style={styles.title}
                        >
                            {t('ledger.verify.complete')}
                        </PWText>
                    </>
                )}
            </PWView>
        </PWView>
    )
}
