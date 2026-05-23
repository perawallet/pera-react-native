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
    PWScreen,
    PWSwitch,
    PWText,
    PWView,
    PWTouchableOpacity,
    PWIcon,
} from '@components/core'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsSecurityScreen } from './useSettingsSecurityScreen'
import { useStyles } from './styles'

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
        <PWScreen testID='settings_security_screen'>
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
                            <PWText
                                style={styles.listItemLabel}
                                truncate
                            >
                                {t('settings.security.enable_pin_security')}
                            </PWText>
                        </PWView>
                        <PWView style={styles.trailingContainer}>
                            <PWSwitch
                                value={isPinEnabled}
                                onValueChange={handlePinToggle}
                                testID='settings_security_pin_toggle'
                            />
                        </PWView>
                    </PWView>

                    {isPinEnabled && (
                        <PWTouchableOpacity
                            style={styles.listItem}
                            onPress={handleChangePinPress}
                            testID='settings_security_change_pin_button'
                        >
                            <PWView style={styles.listItemContent}>
                                <PWIcon name='locked' />
                                <PWText
                                    style={styles.listItemLabel}
                                    truncate
                                >
                                    {t('settings.security.change_pin')}
                                </PWText>
                            </PWView>
                            <PWView style={styles.trailingContainer}>
                                <PWIcon name='chevron-right' />
                            </PWView>
                        </PWTouchableOpacity>
                    )}

                    {isPinEnabled && isBiometricsAvailable && (
                        <PWView style={styles.listItem}>
                            <PWView style={styles.listItemContent}>
                                <PWIcon name='faceid' />
                                <PWText
                                    style={styles.listItemLabel}
                                    truncate
                                >
                                    {t('settings.security.enable_biometrics')}
                                </PWText>
                            </PWView>
                            <PWView style={styles.trailingContainer}>
                                <PWSwitch
                                    value={isBiometricEnabled}
                                    onValueChange={handleBiometricToggle}
                                    testID='settings_security_biometric_toggle'
                                />
                            </PWView>
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
                                <PWText
                                    style={styles.listItemLabel}
                                    truncate
                                >
                                    {t(
                                        'settings.security.advanced_security_settings',
                                    )}
                                </PWText>
                            </PWView>
                            <PWView style={styles.trailingContainer}>
                                <PWSwitch
                                    value={isAdvancedSecurityEnabled}
                                    onValueChange={handleAdvancedSecurityToggle}
                                    testID='settings_security_advanced_toggle'
                                />
                            </PWView>
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
                                        <PWText
                                            style={styles.listItemLabel}
                                            truncate
                                        >
                                            {t(
                                                'settings.security.enable_rekey_support',
                                            )}
                                        </PWText>
                                    </PWView>
                                    <PWView style={styles.trailingContainer}>
                                        <PWSwitch
                                            value={isRekeySupportEnabled}
                                            onValueChange={handleRekeyToggle}
                                            testID='settings_security_rekey_toggle'
                                        />
                                    </PWView>
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
                                        <PWText
                                            style={styles.listItemLabel}
                                            truncate
                                        >
                                            {t(
                                                'settings.security.enable_asset_freeze_support',
                                            )}
                                        </PWText>
                                    </PWView>
                                    <PWView style={styles.trailingContainer}>
                                        <PWSwitch
                                            value={isAssetFreezeSupportEnabled}
                                            onValueChange={
                                                handleAssetFreezeToggle
                                            }
                                            testID='settings_security_asset_freeze_toggle'
                                        />
                                    </PWView>
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
                                            <PWText
                                                style={styles.listItemLabel}
                                                truncate
                                            >
                                                {t(
                                                    'settings.security.shake_to_lock',
                                                )}
                                            </PWText>
                                            <PWView
                                                style={styles.listItemAccessory}
                                            >
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
                                        </PWView>
                                        <PWView
                                            style={styles.trailingContainer}
                                        >
                                            <PWSwitch
                                                value={
                                                    isShakeToLockEnabled &&
                                                    isPinEnabled
                                                }
                                                onValueChange={
                                                    handleShakeToLockToggle
                                                }
                                                disabled={!isPinEnabled}
                                                testID='settings_security_shake_to_lock_toggle'
                                            />
                                        </PWView>
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
                                            <PWText
                                                style={styles.listItemLabel}
                                                truncate
                                            >
                                                {t(
                                                    'settings.security.duress_pin',
                                                )}
                                            </PWText>
                                            <PWView
                                                style={styles.listItemAccessory}
                                            >
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
                                        </PWView>
                                        <PWView
                                            style={styles.trailingContainer}
                                        >
                                            <PWSwitch
                                                value={
                                                    isDuressPinEnabled &&
                                                    isPinEnabled
                                                }
                                                onValueChange={
                                                    handleDuressPinToggle
                                                }
                                                disabled={!isPinEnabled}
                                                testID='settings_security_duress_pin_toggle'
                                            />
                                        </PWView>
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
            </PWView>
        </PWScreen>
    )
}
