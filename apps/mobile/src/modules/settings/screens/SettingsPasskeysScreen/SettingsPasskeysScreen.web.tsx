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
import { PWIcon, PWSwitch, PWText, PWView } from '@components/core'
import { InfoCallout } from '@components/InfoCallout'
import { QRScannerView } from '@components/QRScannerView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { PasskeysEmptyState } from '../../components/PasskeysEmptyState'
import { PasskeysErrorState } from '../../components/PasskeysErrorState'
import { PasskeysList } from '../../components/PasskeysList'
import { PasskeysLoadingState } from '../../components/PasskeysLoadingState'
import { useSettingsPasskeysScreen } from './useSettingsPasskeysScreen.web'
import { useStyles } from './styles'

// Web/extension variant. The native screen's "disabled" state points the
// user at OS credential-provider settings (no such surface exists on web);
// here a master toggle bound to `webauthnInterceptionEnabled` sits above the
// list at all times, making the interception state directly controllable and
// visible instead. See useSettingsPasskeysScreen.web.tsx for how "active" is
// derived from that toggle rather than the native isProviderActive signal.
// Native withholds removal of a migration-flagged passkey while Pera is not the
// OS credential provider, because re-registering needs a settings trip the user
// may not complete. Web has no such state: the interception toggle above the
// list is the only thing gating re-registration, so nothing here is one-way.
const alwaysRemovable = () => true

export const SettingsPasskeyScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const screen = useSettingsPasskeysScreen()

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
        // No passkeys yet, whether because interception is off ('disabled')
        // or on but unused ('empty') — the toggle row above already makes
        // the on/off state clear, so both render the same empty hero.
        case 'disabled':
        case 'empty': {
            content = <PasskeysEmptyState />
            break
        }
        case 'populated': {
            content = (
                <PasskeysList
                    passkeys={screen.passkeys}
                    canRemove={alwaysRemovable}
                    onRequestDelete={screen.onRequestDelete}
                />
            )
            break
        }
    }

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
                <PWView
                    style={styles.toggleRow}
                    testID='settings_passkeys_interception_toggle_row'
                >
                    <PWView style={styles.toggleTextContainer}>
                        <PWText variant='body'>
                            {t('settings.passkeys.interception_toggle_title')}
                        </PWText>
                        <PWText style={styles.toggleSubtitle}>
                            {t(
                                screen.isInterceptionEnabled
                                    ? 'settings.passkeys.interception_toggle_body_enabled'
                                    : 'settings.passkeys.interception_toggle_body_disabled',
                            )}
                        </PWText>
                    </PWView>
                    <PWSwitch
                        value={screen.isInterceptionEnabled}
                        onValueChange={screen.onToggleInterception}
                        testID='settings_passkeys_interception_toggle'
                    />
                </PWView>
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
