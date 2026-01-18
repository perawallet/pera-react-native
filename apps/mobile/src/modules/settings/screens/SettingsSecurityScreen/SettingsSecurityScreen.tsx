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

import { View } from 'react-native'
import {
    PWSwitch,
    PWText,
    PWView,
    PWTouchableOpacity,
    PWIcon,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsSecurityScreen } from './useSettingsSecurityScreen'
import { useStyles } from './styles'

export const SettingsSecurityScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        isPinEnabled,
        isBiometricEnabled,
        isBiometricAvailable,
        handlePinToggle,
        handleBiometricToggle,
        handleChangePinPress,
    } = useSettingsSecurityScreen()

    return (
        <PWView style={styles.container}>
            {/* Security Settings Section */}
            <PWView style={styles.section}>
                <PWText variant="body" style={styles.sectionTitle}>
                    {t('settings.security.security_settings_section')}
                </PWText>

                {/* Enable PIN Security */}
                <PWView style={styles.listItem}>
                    <PWView style={styles.listItemContent}>
                        <PWText style={styles.listItemTitle}>
                            {t('settings.security.enable_pin_security')}
                        </PWText>
                        <PWText style={styles.listItemSubtitle}>
                            {t(
                                'settings.security.enable_pin_security_description',
                            )}
                        </PWText>
                    </PWView>
                    <PWSwitch
                        value={isPinEnabled}
                        onValueChange={handlePinToggle}
                    />
                </PWView>

                {isPinEnabled && (
                    <>
                        {/* Change PIN */}
                        <PWTouchableOpacity
                            style={styles.listItem}
                            onPress={handleChangePinPress}
                        >
                            <PWText style={styles.listItemTitle}>
                                {t('settings.security.change_pin')}
                            </PWText>
                            <PWIcon name="chevron-right" size="sm" />
                        </PWTouchableOpacity>

                        {/* Enable Biometrics */}
                        {isBiometricAvailable && (
                            <PWView style={styles.listItem}>
                                <PWView style={styles.listItemContent}>
                                    <PWText style={styles.listItemTitle}>
                                        {t('settings.security.enable_biometrics')}
                                    </PWText>
                                    <PWText style={styles.listItemSubtitle}>
                                        {t(
                                            'settings.security.enable_biometrics_description',
                                        )}
                                    </PWText>
                                </PWView>
                                <PWSwitch
                                    value={isBiometricEnabled}
                                    onValueChange={handleBiometricToggle}
                                />
                            </PWView>
                        )}
                    </>
                )}
            </PWView>

            {/* Anti-spam Protection Section */}
            <PWView style={styles.section}>
                <PWText variant="body" style={styles.sectionTitle}>
                    {t('settings.security.antispam_section')}
                </PWText>

                {/* Enable Re-key Support */}
                <PWView style={styles.listItem}>
                    <PWView style={styles.listItemContent}>
                        <PWText style={styles.listItemTitle}>
                            {t('settings.security.enable_rekey_support')}
                        </PWText>
                        <PWText style={styles.listItemSubtitle}>
                            {t(
                                'settings.security.enable_rekey_support_description',
                            )}
                        </PWText>
                    </PWView>
                    <PWSwitch
                        value={false}
                        onValueChange={() => {
                            // TODO: Implement re-key support
                        }}
                        disabled
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}
