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

import { PWScreen, PWRadioButton, PWText, PWView } from '@components/core'
import { AccountPicker } from '@modules/accounts/components/AccountPicker'
import { useLanguage } from '@hooks/useLanguage'
import { useSettingsLaunchScreen } from './useSettingsLaunchScreen'
import { useStyles } from './styles'

export const SettingsLaunchScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        launchAccountMode,
        launchAccountAddress,
        accounts,
        isAccountPickerVisible,
        handleSelectLastUsed,
        handleSelectSpecific,
        handleSelectAccount,
    } = useSettingsLaunchScreen()

    return (
        <PWScreen testID='settings_launch_screen'>
            <PWView style={styles.container}>
                <PWText
                    variant='body'
                    style={styles.sectionTitle}
                >
                    {t('settings.launch.account_section')}
                </PWText>

                <PWView style={styles.options}>
                    <PWRadioButton
                        onPress={handleSelectLastUsed}
                        isSelected={launchAccountMode === 'lastUsed'}
                        testID='settings_launch_last_used_radio'
                    >
                        <PWView style={styles.optionLabel}>
                            <PWText>
                                {t('settings.launch.last_used_label')}
                            </PWText>
                            <PWText style={styles.optionDescription}>
                                {t('settings.launch.last_used_description')}
                            </PWText>
                        </PWView>
                    </PWRadioButton>

                    <PWRadioButton
                        onPress={handleSelectSpecific}
                        isSelected={launchAccountMode === 'specific'}
                        testID='settings_launch_specific_radio'
                    >
                        <PWView style={styles.optionLabel}>
                            <PWText>
                                {t('settings.launch.specific_label')}
                            </PWText>
                            <PWText style={styles.optionDescription}>
                                {t('settings.launch.specific_description')}
                            </PWText>
                        </PWView>
                    </PWRadioButton>
                </PWView>

                {isAccountPickerVisible && (
                    <PWView style={styles.picker}>
                        <AccountPicker
                            accounts={accounts}
                            onSelect={handleSelectAccount}
                            highlightedAddress={
                                launchAccountAddress ?? undefined
                            }
                            rowTestIDPrefix='settings_launch_account'
                        />
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
