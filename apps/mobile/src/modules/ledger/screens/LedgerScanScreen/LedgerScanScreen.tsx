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

import { useCallback, useLayoutEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWLottie,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { ScreenHeader } from '@components/ScreenHeader'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import animationSourceLight from '@assets/animations/ledger-searching.json'
import animationSourceDark from '@assets/animations/ledger-searching.dark.json'
import { LedgerDeviceItem } from '../../components/LedgerDeviceItem'
import { useStyles } from './styles'
import { useLedgerScanScreen } from './useLedgerScanScreen'

import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

export const LedgerScanScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation()
    const isDarkMode = useIsDarkMode()
    const animationSource = isDarkMode
        ? animationSourceDark
        : animationSourceLight
    const {
        devices,
        error,
        isPermissionDenied,
        shouldOpenSettings,
        isLocationServicesDisabled,
        isScanTimeout,
        isUsbOnly,
        needsManualStart,
        isPopupSurface,
        handleDevicePress,
        handleStartScan,
        handleRetry,
        handleRequestPermissions,
        handleOpenLocationSettings,
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

    const renderItem = useCallback(
        ({ item }: { item: HardwareWalletDevice }) => (
            <LedgerDeviceItem
                device={item}
                onPress={handleDevicePress}
            />
        ),
        [handleDevicePress],
    )

    const renderEmptyState = () => {
        if (!error) {
            return null
        }
        if (isScanTimeout) {
            return (
                <EmptyView
                    icon='warning'
                    title={t('ledger.errors.scan_timeout_title')}
                    body={t('ledger.errors.scan_timeout')}
                    button={
                        <PWButton
                            testID='ledger_scan_retry_button'
                            title={t('ledger.scan.retry')}
                            onPress={handleRetry}
                            variant='link'
                        />
                    }
                />
            )
        }
        if (isLocationServicesDisabled) {
            return (
                <EmptyView
                    icon='warning'
                    body={t('ledger.scan.location_services_disabled')}
                    button={
                        <PWButton
                            testID='ledger_scan_location_settings_button'
                            title={t('ledger.scan.open_location_settings')}
                            onPress={handleOpenLocationSettings}
                            variant='link'
                        />
                    }
                />
            )
        }
        return (
            <EmptyView
                icon='warning'
                body={t(
                    isUsbOnly ? 'ledger.scan.usb_error' : 'ledger.scan.error',
                )}
                button={
                    <PWButton
                        testID='ledger_scan_retry_button'
                        title={t('ledger.scan.retry')}
                        onPress={handleRetry}
                        variant='link'
                    />
                }
            />
        )
    }

    return (
        <PWScreen scroll='never'>
            {/* Constrains width on the wide "expanded" browser-tab surface —
                unconstrained flex:1 content otherwise spreads the
                fixed-width header animation to the literal edges of a
                ~1600px viewport. A no-op in the 360px popup (already
                narrower than the cap). */}
            <PWView style={styles.content}>
                {/* A failed scan (timeout, BLE error) must not keep faking an
                    active search — the looping animation only renders while the
                    scan can still produce devices. Also withheld on web before
                    the user has tapped "Search for Ledger" — nothing is
                    scanning yet. */}
                {!error && !needsManualStart && (
                    <PWLottie
                        autoPlay
                        loop
                        source={animationSource}
                        style={styles.headerAnimation}
                        testID='ledger_scan_animation'
                    />
                )}
                <ScreenHeader
                    title={t('ledger.scan.title')}
                    description={t('ledger.scan.description')}
                />

                {needsManualStart ? (
                    <EmptyView
                        icon='ledger'
                        title={t(
                            isPopupSurface
                                ? 'ledger.scan.popup_launch_title'
                                : 'ledger.scan.web_start_title',
                        )}
                        body={t(
                            isPopupSurface
                                ? 'ledger.scan.popup_launch_body'
                                : 'ledger.scan.web_start_body',
                        )}
                        button={
                            <PWButton
                                testID='ledger_scan_start_button'
                                title={t(
                                    isPopupSurface
                                        ? 'ledger.scan.popup_launch_button'
                                        : 'ledger.scan.web_start_button',
                                )}
                                onPress={handleStartScan}
                                variant='primary'
                            />
                        }
                    />
                ) : isPermissionDenied ? (
                    <PWView
                        style={styles.errorContainer}
                        testID='ledger_scan_permission_denied'
                    >
                        <PWText
                            variant='body'
                            style={styles.errorText}
                        >
                            {t(
                                'ledger.instructions.permission_required_message',
                            )}
                        </PWText>
                        <PWButton
                            testID='ledger_scan_grant_permission_button'
                            title={t(
                                shouldOpenSettings
                                    ? 'ledger.scan.open_settings'
                                    : 'ledger.scan.grant_permission',
                            )}
                            onPress={handleRequestPermissions}
                            variant='link'
                        />
                    </PWView>
                ) : (
                    <PWFlatList
                        data={devices}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        ListEmptyComponent={renderEmptyState}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </PWView>
        </PWScreen>
    )
}
