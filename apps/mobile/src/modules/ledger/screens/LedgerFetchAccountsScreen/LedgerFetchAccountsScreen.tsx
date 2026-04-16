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
import { PWView, PWText, PWResultView } from '@components/core'

import { LedgerStatusIndicator } from '../../components/LedgerStatusIndicator'
import { useStyles } from './styles'
import { useLedgerFetchAccountsScreen } from './useLedgerFetchAccountsScreen'

export const LedgerFetchAccountsScreen = () => {
    const styles = useStyles()
    const {
        connectionStatus,
        isDiscovering,
        progress,
        errorPreset,
        handleRetry,
        handleTroubleshoot,
        t,
    } = useLedgerFetchAccountsScreen()

    const isLoading =
        connectionStatus === 'connecting' ||
        connectionStatus === 'connected' ||
        isDiscovering

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
                testID='ledger-fetch-accounts-error'
            />
        )
    }

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
                            {isDiscovering
                                ? t('ledger.fetch_accounts.discovering')
                                : t('ledger.fetch_accounts.connecting')}
                        </PWText>

                        {isDiscovering && progress.current > 0 && (
                            <PWText
                                variant='body'
                                style={styles.progressText}
                            >
                                {t('ledger.fetch_accounts.progress', {
                                    count: progress.current,
                                })}
                            </PWText>
                        )}

                        <PWView style={styles.statusContainer}>
                            <LedgerStatusIndicator status={connectionStatus} />
                        </PWView>
                    </>
                )}
            </PWView>
        </PWView>
    )
}
