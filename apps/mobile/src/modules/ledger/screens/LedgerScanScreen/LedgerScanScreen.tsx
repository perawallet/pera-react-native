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

import { useLayoutEffect } from 'react'
import {
    PWView,
    PWText,
    PWFlatList,
    PWButton,
    PWIcon,
    PWTouchableOpacity,
} from '@components/core'
import { useNavigation } from '@react-navigation/native'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

import { LedgerDeviceItem } from '../../components/LedgerDeviceItem'
import { LedgerCompositeIcon } from '../../components/LedgerCompositeIcon'
import { LedgerConnectingBottomSheet } from '../../components/LedgerConnectingBottomSheet'
import { useStyles } from './styles'
import { useLedgerScanScreen } from './useLedgerScanScreen'

export const LedgerScanScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation()
    const {
        devices,
        isScanning: _isScanning,
        error,
        connectingDevice,
        handleDevicePress,
        handleCancelConnecting,
        handleRetry,
        handleTroubleshoot,
        t,
    } = useLedgerScanScreen()

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <PWTouchableOpacity
                    onPress={handleTroubleshoot}
                    testID='ledger_scan_help_button'
                    accessibilityLabel={t('ledger.scan_header.having_issues')}
                >
                    <PWIcon name='question-mark' />
                </PWTouchableOpacity>
            ),
        })
    }, [navigation, handleTroubleshoot, t])

    const renderItem = ({ item }: { item: HardwareWalletDevice }) => (
        <LedgerDeviceItem
            device={item}
            onPress={handleDevicePress}
        />
    )

    const renderEmptyState = () => {
        if (!error) {
            return null
        }
        return (
            <PWView style={styles.errorContainer}>
                <PWText
                    variant='body'
                    style={styles.errorText}
                >
                    {t('ledger.scan.error')}
                </PWText>
                <PWButton
                    testID='ledger_scan_retry_button'
                    title={t('ledger.scan.retry')}
                    onPress={handleRetry}
                    variant='link'
                />
            </PWView>
        )
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.header}>
                <PWView style={styles.icon}>
                    <LedgerCompositeIcon state='idle' />
                </PWView>
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
            </PWView>

            <PWFlatList
                data={devices}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <LedgerConnectingBottomSheet
                isVisible={connectingDevice !== null}
                onCancel={handleCancelConnecting}
            />
        </PWView>
    )
}
