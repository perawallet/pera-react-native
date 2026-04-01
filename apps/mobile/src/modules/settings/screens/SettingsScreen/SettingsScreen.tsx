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
    type IconName,
    PWButton,
    PWListItem,
    PWText,
    PWView,
    PWScrollView,
} from '@components/core'

import { useStyles } from './styles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppVersion } from '@modules/settings/components/AppVersion'
import { useSettingsScreen } from './useSettingsScreen'
import { useLanguage } from '@hooks/useLanguage'
import type { SettingsStackParamsList } from '@modules/settings/routes'
import { RatingsBottomSheet } from '@modules/settings/components/RatingsBottomSheet/RatingsBottomSheet'
import { DeleteAllConfirmBottomSheet } from '@modules/settings/components/DeleteAllConfirmBottomSheet/DeleteAllConfirmBottomSheet'
import { DeleteAllSuccessBottomSheet } from '@modules/settings/components/DeleteAllSuccessBottomSheet'
import { getTestProps } from '@utils/test-id-helper'

export type SettingsRouteName = keyof SettingsStackParamsList

export const SettingsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const {
        settingsOptions,
        handleTapEvent,
        isDeleteModalOpen,
        openDeleteModal,
        closeDeleteModal,
        isSuccessModalOpen,
        handleDeleteSuccess,
        handleSuccessClose,
        isRatingModalOpen,
        closeRatingModal,
    } = useSettingsScreen()

    return (
        <PWScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            testID='settings_screen'
        >
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
                onPress={openDeleteModal}
                {...getTestProps('settings_remove_all_accounts_button')}
            />
            <AppVersion enableSecretTaps />
            <DeleteAllConfirmBottomSheet
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onSuccess={handleDeleteSuccess}
                testID='settings_delete_all_confirm_bottom_sheet'
            />
            <DeleteAllSuccessBottomSheet
                isVisible={isSuccessModalOpen}
                onClose={handleSuccessClose}
                testID='settings_delete_all_success_bottom_sheet'
            />
            <RatingsBottomSheet
                isOpen={isRatingModalOpen}
                onClose={closeRatingModal}
                testID='settings_ratings_bottom_sheet'
            />
        </PWScrollView>
    )
}
