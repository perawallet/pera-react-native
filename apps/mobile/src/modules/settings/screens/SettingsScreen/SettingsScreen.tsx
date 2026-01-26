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
    IconName,
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWListItem,
    PWText,
    PWView,
} from '@components/core'

import { useStyles } from './styles'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppVersion } from '@modules/settings/components/AppVersion'
import { useSettingsScreen } from './useSettingsScreen'
import { useLanguage } from '@hooks/useLanguage'
import { SettingsStackParamsList } from '@modules/settings/routes'

//TODO: add ratings view handling
export type SettingsRouteName = keyof SettingsStackParamsList

export const SettingsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const {
        settingsOptions,
        handleTapEvent,
        handleDeleteAllAccounts,
        isDeleteModalOpen,
        openDeleteModal,
        closeDeleteModal,
    } = useSettingsScreen()

    return (
        <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
        >
            <PWView style={styles.sectionContainer}>
                {settingsOptions.map(item => (
                    <PWView
                        style={styles.section}
                        key={`settings-section-${item.title}`}
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
                            />
                        ))}
                    </PWView>
                ))}
            </PWView>
            <PWButton
                variant='secondary'
                title={t('settings.main.remove_all_accounts')}
                onPress={openDeleteModal}
            />
            <AppVersion enableSecretTaps />
            <PWBottomSheet
                isVisible={isDeleteModalOpen}
                onBackdropPress={closeDeleteModal}
                innerContainerStyle={styles.bottomSheetContainer}
            >
                <PWIcon
                    name='trash'
                    variant='error'
                    size='xl'
                    style={styles.bottomSheetIcon}
                />
                <PWText variant='h3'>{t('settings.main.remove_title')}</PWText>
                <PWText style={styles.bottomSheetMessage}>
                    {t('settings.main.remove_message')}
                </PWText>
                <PWView style={styles.bottomSheetActions}>
                    <PWButton
                        variant='primary'
                        title={t('settings.main.remove_confirm')}
                        onPress={handleDeleteAllAccounts}
                        paddingStyle='dense'
                    />
                    <PWButton
                        variant='secondary'
                        title={t('settings.main.remove_cancel')}
                        onPress={closeDeleteModal}
                        paddingStyle='dense'
                    />
                </PWView>
            </PWBottomSheet>
        </ScrollView>
    )
}
