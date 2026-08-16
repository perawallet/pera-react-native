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

import type { ReactNode } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PWIcon, PWView } from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { PasskeyMigrationBanner } from '../../components/PasskeyMigrationBanner'
import { PasskeysDisabledState } from '../../components/PasskeysDisabledState'
import { PasskeysEmptyState } from '../../components/PasskeysEmptyState'
import { PasskeysErrorState } from '../../components/PasskeysErrorState'
import { PasskeysList } from '../../components/PasskeysList'
import { PasskeysLoadingState } from '../../components/PasskeysLoadingState'
import { useSettingsPasskeysScreen } from './useSettingsPasskeysScreen'
import { useStyles } from './styles'

export const SettingsPasskeyScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const screen = useSettingsPasskeysScreen()
    const migration = screen.migration

    // Same QR entry point as the WalletConnect / home scanners — scanned
    // `fido://` (and reserved `liquid://`) codes route through the shared
    // deeplink handler, so registration / assertion works identically here.
    useNavigationHeader({
        right: screen.canScan ? (
            <PWView testID='passkeys_qr_scanner_button'>
                <PWIcon
                    name='camera'
                    onPress={screen.onOpenScanner}
                />
            </PWView>
        ) : null,
    })

    let content: ReactNode
    switch (screen.state) {
        case 'loading': {
            content = <PasskeysLoadingState />
            break
        }
        case 'error': {
            content = <PasskeysErrorState onDismiss={screen.onDismissError} />
            break
        }
        case 'disabled': {
            content = (
                <PasskeysDisabledState
                    onOpenSettings={() => void screen.onOpenProviderSettings()}
                />
            )
            break
        }
        case 'empty': {
            content = <PasskeysEmptyState />
            break
        }
        case 'populated': {
            content = (
                <PasskeysList
                    passkeys={screen.passkeys}
                    onRequestDelete={screen.onRequestDelete}
                />
            )
            break
        }
    }

    // The populated list owns its bottom safe-area inset (so rows scroll under
    // the home indicator); every other state is centered or bottom-anchored and
    // relies on the screen to supply the inset.
    const bottomEdges =
        screen.state === 'populated' ? [] : (['bottom'] as const)

    return (
        <SafeAreaView
            edges={bottomEdges}
            style={styles.safeArea}
        >
            <PWView
                testID='settings_passkeys_screen'
                style={styles.screenContainer}
            >
                {migration.isVisible && (
                    <PasskeyMigrationBanner
                        affected={migration.affected}
                        canRecreate={migration.canRecreate}
                        onRecreate={migration.onRecreate}
                        onDismiss={migration.onDismiss}
                        style={styles.notice}
                    />
                )}
                {screen.notice === 'hd-wallet' && (
                    <InfoCallout
                        title={t('settings.passkeys.hd_wallet_warning_title')}
                        body={t('settings.passkeys.hd_wallet_warning_body')}
                        style={styles.notice}
                        testID='settings_passkeys_hd_wallet_notice'
                    />
                )}
                {screen.notice === 'biometric' && (
                    <InfoCallout
                        title={t('settings.passkeys.biometric_warning_title')}
                        body={t('settings.passkeys.biometric_warning_body')}
                        style={styles.notice}
                        testID='settings_passkeys_biometric_notice'
                    />
                )}
                {content}
                <QRScannerView
                    isVisible={screen.isScannerVisible}
                    onSuccess={screen.onCloseScanner}
                    onClose={screen.onCloseScanner}
                    animationType='slide'
                />
            </PWView>
        </SafeAreaView>
    )
}
