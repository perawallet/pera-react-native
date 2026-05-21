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
    PWScrollView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsSecurityScreen } from './useSettingsSecurityScreen'
import { useStyles } from './styles'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { InfoButton } from '@components/InfoButton'

export const SettingsSecurityScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()

    const {
        isPinEnabled,
        isBiometricEnabled,
        isBiometricsAvailable,
        isAdvancedSecurityEnabled,
        isRekeySupportEnabled,
        isAssetFreezeSupportEnabled,
        isShakeToLockFeatureEnabled,
        isShakeToLockEnabled,
        isDuressPinFeatureEnabled,
        isDuressPinEnabled,
        handlePinToggle,
        handleBiometricToggle,
        handleChangePinPress,
        handleAdvancedSecurityToggle,
        handleRekeyToggle,
        handleAssetFreezeToggle,
        handleShakeToLockToggle,
        handleDuressPinToggle,
    } = useSettingsSecurityScreen()

    return (
        <PWScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            testID='settings_security_screen'
        >
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
                        testID='settings_security_pin_toggle'
                    />
                </PWView>

                {isPinEnabled && (
                    <PWTouchableOpacity
                        style={styles.listItem}
                        onPress={handleChangePinPress}
                        testID='settings_security_change_pin_button'
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
                            testID='settings_security_biometric_toggle'
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

                <PWView>
                    <PWView style={styles.listItem}>
                        <PWView style={styles.listItemContent}>
                            <PWIcon name='shield-check' />
                            <PWText>
                                {t(
                                    'settings.security.advanced_security_settings',
                                )}
                            </PWText>
                        </PWView>
                        <PWSwitch
                            value={isAdvancedSecurityEnabled}
                            onValueChange={handleAdvancedSecurityToggle}
                            testID='settings_security_advanced_toggle'
                        />
                    </PWView>
                    <PWText style={styles.listItemSubtitle}>
                        {t(
                            'settings.security.advanced_security_settings_description',
                        )}
                    </PWText>
                </PWView>

                <ExpandablePanel isExpanded={isAdvancedSecurityEnabled}>
                    <PWView style={styles.expandablePanelContent}>
                        <PWView>
                            <PWView style={styles.listItem}>
                                <PWView style={styles.listItemContent}>
                                    <PWIcon name='rekey' />
                                    <PWText>
                                        {t(
                                            'settings.security.enable_rekey_support',
                                        )}
                                    </PWText>
                                </PWView>
                                <PWSwitch
                                    value={isRekeySupportEnabled}
                                    onValueChange={handleRekeyToggle}
                                    testID='settings_security_rekey_toggle'
                                />
                            </PWView>
                            <PWText style={styles.listItemSubtitle}>
                                {t(
                                    'settings.security.enable_rekey_support_description',
                                )}
                            </PWText>
                        </PWView>
                        <PWView>
                            <PWView style={styles.listItem}>
                                <PWView style={styles.listItemContent}>
                                    <PWIcon name='snowflake' />
                                    <PWText>
                                        {t(
                                            'settings.security.enable_asset_freeze_support',
                                        )}
                                    </PWText>
                                </PWView>
                                <PWSwitch
                                    value={isAssetFreezeSupportEnabled}
                                    onValueChange={handleAssetFreezeToggle}
                                    testID='settings_security_asset_freeze_toggle'
                                />
                            </PWView>
                            <PWText style={styles.listItemSubtitle}>
                                {t(
                                    'settings.security.enable_asset_freeze_support_description',
                                )}
                            </PWText>
                        </PWView>

                        {isShakeToLockFeatureEnabled && (
                            <PWView>
                                <PWView style={styles.listItem}>
                                    <PWView style={styles.listItemContent}>
                                        <PWIcon name='shield-check' />
                                        <PWText>
                                            {t(
                                                'settings.security.shake_to_lock',
                                            )}
                                        </PWText>
                                        <InfoButton
                                            title={t(
                                                'settings.security.shake_to_lock_info_title',
                                            )}
                                        >
                                            <PWText>
                                                {t(
                                                    'settings.security.shake_to_lock_info_body',
                                                )}
                                            </PWText>
                                        </InfoButton>
                                    </PWView>
                                    <PWSwitch
                                        value={
                                            isShakeToLockEnabled && isPinEnabled
                                        }
                                        onValueChange={handleShakeToLockToggle}
                                        disabled={!isPinEnabled}
                                        testID='settings_security_shake_to_lock_toggle'
                                    />
                                </PWView>
                                <PWText style={styles.listItemSubtitle}>
                                    {isPinEnabled
                                        ? t(
                                              'settings.security.shake_to_lock_description',
                                          )
                                        : t(
                                              'settings.security.shake_to_lock_requires_pin',
                                          )}
                                </PWText>
                            </PWView>
                        )}

                        {isDuressPinFeatureEnabled && (
                            <PWView>
                                <PWView style={styles.listItem}>
                                    <PWView style={styles.listItemContent}>
                                        <PWIcon name='locked' />
                                        <PWText>
                                            {t('settings.security.duress_pin')}
                                        </PWText>
                                        <InfoButton
                                            title={t(
                                                'settings.security.duress_pin_info_title',
                                            )}
                                        >
                                            <PWText>
                                                {t(
                                                    'settings.security.duress_pin_info_body',
                                                )}
                                            </PWText>
                                        </InfoButton>
                                    </PWView>
                                    <PWSwitch
                                        value={
                                            isDuressPinEnabled && isPinEnabled
                                        }
                                        onValueChange={handleDuressPinToggle}
                                        disabled={!isPinEnabled}
                                        testID='settings_security_duress_pin_toggle'
                                    />
                                </PWView>
                                <PWText style={styles.listItemSubtitle}>
                                    {isPinEnabled
                                        ? t(
                                              'settings.security.duress_pin_description',
                                          )
                                        : t(
                                              'settings.security.duress_pin_requires_pin',
                                          )}
                                </PWText>
                            </PWView>
                        )}
                    </PWView>
                </ExpandablePanel>
            </PWView>
        </PWScrollView>
    )
}
