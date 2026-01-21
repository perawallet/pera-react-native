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
import { PinEditView } from '@modules/security/components/PinEditView/PinEditView'

export const SettingsSecurityScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        pinViewMode,
        isPinEnabled,
        isBiometricEnabled,
        isBiometricsAvailable,
        handlePinToggle,
        handleBiometricToggle,
        handleChangePinPress,
        pinSetSuccess,
        clearPinViewMode,
    } = useSettingsSecurityScreen()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.section}>
                <PWText
                    variant='body'
                    style={styles.sectionTitle}
                >
                    {t('settings.security.security_settings_section')}
                </PWText>

                <PWView style={styles.listItem}>
                    <PWView style={styles.listItemContent}>
                        <PWIcon name='shield-check' />
                        <PWText>
                            {t('settings.security.enable_pin_security')}
                        </PWText>
                    </PWView>
                    <PWSwitch
                        value={isPinEnabled}
                        onValueChange={handlePinToggle}
                    />
                </PWView>

                {isPinEnabled && (
                    <PWTouchableOpacity
                        style={styles.listItem}
                        onPress={handleChangePinPress}
                    >
                        <PWView style={styles.listItemContent}>
                            <PWIcon name='locked' />
                            <PWText>{t('settings.security.change_pin')}</PWText>
                        </PWView>
                        <PWIcon name='chevron-right' />
                    </PWTouchableOpacity>
                )}

                {isPinEnabled && isBiometricsAvailable && (
                    <PWView style={styles.listItem}>
                        <PWView style={styles.listItemContent}>
                            <PWIcon name='faceid' />
                            <PWText>
                                {t('settings.security.enable_biometrics')}
                            </PWText>
                        </PWView>
                        <PWSwitch
                            value={isBiometricEnabled}
                            onValueChange={handleBiometricToggle}
                        />
                    </PWView>
                )}
            </PWView>

            <PWView style={styles.section}>
                <PWText
                    variant='body'
                    style={styles.sectionTitle}
                >
                    {t('settings.security.antispam_section')}
                </PWText>

                <PWView style={styles.listItem}>
                    <PWView style={styles.listItemContent}>
                        <PWIcon name='rekey' />
                        <PWText>
                            {t('settings.security.enable_rekey_support')}
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
                <PWText style={styles.listItemSubtitle}>
                    {t('settings.security.enable_rekey_support_description')}
                </PWText>
            </PWView>

            <PinEditView
                mode={pinViewMode}
                onSuccess={pinSetSuccess}
                onClose={clearPinViewMode}
            />
        </PWView>
    )
}
