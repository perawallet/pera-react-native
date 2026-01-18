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
    PWListItem,
    PWSwitch,
    PWDialog,
    PWButton,
    PWText,
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
        showDeletePinDialog,
        handlePinToggle,
        handleBiometricToggle,
        handleChangePinPress,
        handleDeletePinConfirm,
        handleDeletePinCancel,
    } = useSettingsSecurityScreen()

    return (
        <View style={styles.container}>
            <View style={styles.section}>
                <PWText
                    variant='body'
                    style={styles.sectionTitle}
                >
                    {t('settings.security.pin_section')}
                </PWText>
                <PWListItem
                    title={t('settings.security.pin_code')}
                    subtitle={t('settings.security.pin_code_description')}
                    rightElement={
                        <PWSwitch
                            value={isPinEnabled}
                            onValueChange={handlePinToggle}
                        />
                    }
                />
                {isPinEnabled && (
                    <>
                        <PWListItem
                            title={t('settings.security.change_pin')}
                            onPress={handleChangePinPress}
                            showChevron
                        />
                        {isBiometricAvailable && (
                            <PWListItem
                                title={t('settings.security.biometric')}
                                subtitle={t(
                                    'settings.security.biometric_description',
                                )}
                                rightElement={
                                    <PWSwitch
                                        value={isBiometricEnabled}
                                        onValueChange={handleBiometricToggle}
                                    />
                                }
                            />
                        )}
                    </>
                )}
            </View>

            <PWDialog
                isVisible={showDeletePinDialog}
                title={t('settings.security.delete_pin_title')}
                onBackdropPress={handleDeletePinCancel}
            >
                <PWText style={styles.dialogText}>
                    {t('settings.security.delete_pin_message')}
                </PWText>
                <View style={styles.dialogActions}>
                    <PWButton
                        variant='secondary'
                        title={t('common.cancel.label')}
                        onPress={handleDeletePinCancel}
                        style={styles.dialogButton}
                    />
                    <PWButton
                        variant='destructive'
                        title={t('common.delete.label')}
                        onPress={handleDeletePinConfirm}
                        style={styles.dialogButton}
                    />
                </View>
            </PWDialog>
        </View>
    )
}
