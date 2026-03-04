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

import { PWBottomSheet, PWHeader, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { NotificationSettingsList } from '@modules/settings/components/NotificationSettingsList'
import { useStyles } from './styles'

export type NotificationSettingsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const NotificationSettingsBottomSheet = ({
    isVisible,
    onClose,
}: NotificationSettingsBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            enablePanDownToClose
        >
            <PWView style={styles.container}>
                <PWHeader
                    title={t('settings.main.notifications_title')}
                    leftIcon='cross'
                    onLeftPress={onClose}
                />

                <NotificationSettingsList
                    scrollEnabled={false}
                    contentContainerStyle={styles.scrollContent}
                />
            </PWView>
        </PWBottomSheet>
    )
}
