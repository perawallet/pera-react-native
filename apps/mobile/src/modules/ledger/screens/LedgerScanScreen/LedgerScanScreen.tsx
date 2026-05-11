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
import { PWView, PWText, PWFlatList, PWButton } from '@components/core'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

import { LedgerDeviceItem } from '../../components/LedgerDeviceItem'
import { useStyles } from './styles'
import { useLedgerScanScreen } from './useLedgerScanScreen'

export const LedgerScanScreen = () => {
    const styles = useStyles()
    const {
        devices,
        isScanning,
        error,
        handleDevicePress,
        handleRetry,
        handleTroubleshoot,
        t,
    } = useLedgerScanScreen()

    const renderItem = ({ item }: { item: HardwareWalletDevice }) => (
        <LedgerDeviceItem
            device={item}
            onPress={handleDevicePress}
        />
    )

    const renderEmptyState = () => (
        <PWView style={styles.emptyContainer}>
            {isScanning ? (
                <>
                    <ActivityIndicator size='large' />
                    <PWText
                        variant='body'
                        style={styles.emptyText}
                    >
                        {t('ledger.scan.searching')}
                    </PWText>
                </>
            ) : (
                <>
                    <PWText
                        variant='body'
                        style={styles.emptyText}
                    >
                        {error
                            ? t('ledger.scan.error')
                            : t('ledger.scan.no_devices')}
                    </PWText>
                    <PWButton
                        testID='ledger_scan_retry_button'
                        title={t('ledger.scan.retry')}
                        onPress={handleRetry}
                        variant='secondary'
                    />
                    <PWButton
                        testID='ledger_scan_troubleshoot_button'
                        title={t('ledger.scan_header.having_issues')}
                        onPress={handleTroubleshoot}
                        variant='link'
                    />
                </>
            )}
        </PWView>
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('ledger.scan.title')}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {t('ledger.scan.description')}
                </PWText>

                {isScanning && devices.length > 0 && (
                    <PWView style={styles.scanningRow}>
                        <ActivityIndicator size='small' />
                        <PWText
                            variant='caption'
                            style={styles.scanningText}
                        >
                            {t('ledger.scan.scanning')}
                        </PWText>
                    </PWView>
                )}
            </PWView>

            <PWFlatList
                data={devices}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </PWView>
    )
}
