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
import { PWView, PWText, PWButton, PWIcon } from '@components/core'

import { formatAddress } from '../../utils'
import { useStyles } from './styles'
import { useLedgerVerifyScreen } from './useLedgerVerifyScreen'

export const LedgerVerifyScreen = () => {
    const styles = useStyles()
    const {
        verificationState,
        currentIndex,
        totalAccounts,
        currentAddress,
        error,
        handleRetry,
        t,
    } = useLedgerVerifyScreen()

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
                                        {formatAddress(currentAddress)}
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

                {verificationState === 'error' && error !== null && (
                    <>
                        <PWText
                            variant='h2'
                            style={styles.title}
                        >
                            {t('ledger.verify.error_title')}
                        </PWText>
                        <PWText
                            variant='body'
                            style={styles.errorText}
                        >
                            {error.message}
                        </PWText>
                        <PWButton
                            testID='ledger_verify_retry_button'
                            title={t('ledger.verify.retry')}
                            onPress={handleRetry}
                            variant='secondary'
                        />
                    </>
                )}
            </PWView>
        </PWView>
    )
}
