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
    PWButton,
    PWListItem,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { AppVersion } from '@modules/settings/components/AppVersion'
import { getTestProps } from '@utils/test-id-helper'
import { useSettingsScreen } from './useSettingsScreen'
import { useStyles } from './styles'

import type { IconName } from '@components/core'

export const SettingsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { settingsOptions, handleTapEvent, openDeleteConfirm } =
        useSettingsScreen()

    return (
        <PWScreen
            testID='settings_screen'
            body={
                <>
                    <PWView style={styles.sectionContainer}>
                        {settingsOptions.map(item => (
                            <PWView
                                style={styles.section}
                                key={`settings-section-${item.title}`}
                                testID={`settings_section_${item.title.toLowerCase().replace(/\s+/g, '_')}`}
                            >
                                <PWText style={styles.sectionTitle}>
                                    {item.title}
                                </PWText>
                                {item.items.map(page => (
                                    <PWListItem
                                        key={`settings-sectionrow-${page.title}`}
                                        onPress={() => handleTapEvent(page)}
                                        icon={page.icon as IconName}
                                        title={page.title}
                                        style={styles.sectionRow}
                                        testID={`settings_item_${page.title.toLowerCase().replace(/\s+/g, '_')}`}
                                    />
                                ))}
                            </PWView>
                        ))}
                    </PWView>
                    <PWButton
                        variant='secondary'
                        title={t('settings.main.remove_all_accounts')}
                        onPress={openDeleteConfirm}
                        {...getTestProps('settings_remove_all_accounts_button')}
                    />
                    <AppVersion enableSecretTaps />
                </>
            }
        />
    )
}
