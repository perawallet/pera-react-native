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

import { useTheme } from '@rneui/themed'
import {
    IconName,
    PWButton,
    PWDialog,
    PWListItem,
    PWText,
    PWView,
} from '@components/core'

import { useStyles } from './styles'
import { ScrollView } from 'react-native'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { useModalState } from '@hooks/useModalState'
import { useDeleteAllData } from '@modules/settings/hooks/delete-all-data'
import { AppVersion } from '@modules/settings/components/AppVersion'
import { useSettingsOptions } from '@modules/settings/hooks/settings-options'

//TODO: add ratings view handling

export const SettingsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { pushWebView } = useWebView()
    const { t } = useLanguage()
    const { isOpen, open, close } = useModalState()
    const { theme } = useTheme()
    const clearAllData = useDeleteAllData()
    const { settingsOptions } = useSettingsOptions()

    const handleDeleteAllAccounts = () => {
        clearAllData()
        close()
    }

    const goToSettingsPage = (route: string, title: string) => {
        navigation.push(route, { title })
    }

    const openRating = () => {
        //TODO open ratings view here somehow
    }

    const openWebView = (url: string) => {
        pushWebView({
            url,
            id: '',
        })
    }

    const handleTapEvent = (page: {
        title: string
        icon: string
        url?: string
        route?: string
    }) => {
        if (page.route) {
            goToSettingsPage(page.route, page.title)
        } else if (page.url) {
            openWebView(page.url)
        } else {
            openRating()
        }
    }

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContainer}
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
                            />
                        ))}
                    </PWView>
                ))}
            </PWView>
            <PWButton
                variant='secondary'
                title={t('settings.main.remove_all_accounts')}
                onPress={open}
            />
            <AppVersion enableSecretTaps />
            <PWDialog
                isVisible={isOpen}
                onBackdropPress={close}
            >
                <PWDialog.Title title={t('settings.main.remove_title')} />
                <PWText>{t('settings.main.remove_message')}</PWText>
                <PWDialog.Actions>
                    <PWDialog.Button
                        title={t('common.delete.label')}
                        titleStyle={{ color: theme.colors.error }}
                        onPress={handleDeleteAllAccounts}
                    />
                    <PWDialog.Button
                        title={t('common.cancel.label')}
                        onPress={close}
                    />
                </PWDialog.Actions>
            </PWDialog>
        </ScrollView>
    )
}
