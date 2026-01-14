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

import { Dialog, Text, useTheme } from '@rneui/themed'

import PWView from '@components/PWView'
import PWButton from '@components/PWButton'
import { useStyles } from './SettingsScreen.styles'
import { ScrollView } from 'react-native'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useContext } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconName } from '@components/PWIcon'
import { WebViewContext } from '@providers/WebViewProvider'
import PWListItem from '@components/PWListItem'
import { useLanguage } from '@hooks/language'
import { useModalState } from '@hooks/modal-state'
import { useDeleteAllData } from '../hooks/delete-all-data'
import AppVersion from '../components/app-version/AppVersion'
import { useSettingsOptions } from '../hooks/settings-options'

//TODO: add ratings view handling

const SettingsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { pushWebView } = useContext(WebViewContext)
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
                        <Text style={styles.sectionTitle}>{item.title}</Text>
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
            <Dialog
                isVisible={isOpen}
                onBackdropPress={close}
            >
                <Dialog.Title title={t('settings.main.remove_title')} />
                <Text>{t('settings.main.remove_message')}</Text>
                <Dialog.Actions>
                    <Dialog.Button
                        title={t('common.delete.label')}
                        titleStyle={{ color: theme.colors.error }}
                        onPress={handleDeleteAllAccounts}
                    />
                    <Dialog.Button
                        title={t('common.cancel.label')}
                        onPress={close}
                    />
                </Dialog.Actions>
            </Dialog>
        </ScrollView>
    )
}

export default SettingsScreen
