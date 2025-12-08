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

import { useStyles } from './styles'
import PWView from '../../../../components/common/view/PWView'
import { useSettings } from '@perawallet/wallet-core-settings'
import RadioButton from '../../../../components/common/radio-button/RadioButton'
import { useLanguage } from '../../../../hooks/useLanguage'

const SettingsThemeScreen = () => {
    const styles = useStyles()
    const { theme, setTheme } = useSettings()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <RadioButton
                title={t('settings.theme.system_label')}
                onPress={() => setTheme('system')}
                selected={!theme || theme === 'system'}
            />
            <RadioButton
                title={t('settings.theme.light_label')}
                onPress={() => setTheme('light')}
                selected={theme === 'light'}
            />
            <RadioButton
                title={t('settings.theme.dark_label')}
                onPress={() => setTheme('dark')}
                selected={theme === 'dark'}
            />
        </PWView>
    )
}

export default SettingsThemeScreen
