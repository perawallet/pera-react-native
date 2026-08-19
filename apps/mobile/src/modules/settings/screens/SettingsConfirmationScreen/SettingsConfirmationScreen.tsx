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

import { useSettings } from '@perawallet/wallet-core-settings'

import { PWScreen, PWRadioButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export const SettingsConfirmationScreen = () => {
    const styles = useStyles()
    const { confirmationMode, setConfirmationMode } = useSettings()
    const { t } = useLanguage()

    return (
        <PWScreen testID='settings_confirmation_screen'>
            <PWView style={styles.container}>
                <PWText
                    variant='body'
                    style={styles.synopsis}
                >
                    {t('settings.confirmation.synopsis')}
                </PWText>

                <PWView style={styles.options}>
                    <PWRadioButton
                        onPress={() => setConfirmationMode('slide')}
                        isSelected={confirmationMode === 'slide'}
                        testID='settings_confirmation_slide_radio'
                    >
                        <PWView style={styles.optionLabel}>
                            <PWText>
                                {t('settings.confirmation.slide_label')}
                            </PWText>
                            <PWText style={styles.optionDescription}>
                                {t('settings.confirmation.slide_description')}
                            </PWText>
                        </PWView>
                    </PWRadioButton>

                    <PWRadioButton
                        onPress={() => setConfirmationMode('tap')}
                        isSelected={confirmationMode === 'tap'}
                        testID='settings_confirmation_tap_radio'
                    >
                        <PWView style={styles.optionLabel}>
                            <PWText>
                                {t('settings.confirmation.tap_label')}
                            </PWText>
                            <PWText style={styles.optionDescription}>
                                {t('settings.confirmation.tap_description')}
                            </PWText>
                        </PWView>
                    </PWRadioButton>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
