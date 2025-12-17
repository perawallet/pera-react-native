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

import PWView from '@components/view/PWView'
import PWButton from '@components/button/PWButton'
import { useStyles } from './SettingsScreen.styles'
import { ScrollView } from 'react-native'
import {
    ParamListBase,
    StackActions,
    useNavigation,
} from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { useContext, useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconName } from '@components/icons/PWIcon'
import { config } from '@perawallet/wallet-core-config'
import { WebViewContext } from '@providers/WebViewProvider'
import PWListItem from '@components/list-item/PWListItem'
import { useLanguage } from '@hooks/language'
import { useModalState } from '@hooks/modal-state'
import { useDeleteAllData } from '../hooks/delete-all-data'

//TODO: add ratings view handling

const SettingsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { getAppVersion } = useDeviceInfoService()
    const { pushWebView } = useContext(WebViewContext)
    const { t } = useLanguage()
    const { isOpen, open, close } = useModalState()
    const { theme } = useTheme()
    const clearAllData = useDeleteAllData()

    const settingsOptions = useMemo(
        () => [
            {
                title: t('settings.main.account_section'),
                items: [
                    {
                        route: 'SecuritySettings',
                        icon: 'shield-check',
                        title: t('settings.main.security_title'),
                    },
                    {
                        route: 'NotificationsSettings',
                        icon: 'bell',
                        title: t('settings.main.notifications_title'),
                    },
                    {
                        route: 'WalletConnectSettings',
                        icon: 'wallet-connect',
                        title: t('settings.main.wallet_connect_title'),
                    },
                    {
                        route: 'PasskeysSettings',
                        icon: 'person-key',
                        title: t('settings.main.passkeys_title'),
                    },
                ],
            },
            {
                title: t('settings.main.app_preferences_section'),
                items: [
                    {
                        route: 'CurrencySettings',
                        icon: 'dollar',
                        title: t('settings.main.currency_title'),
                    },
                    {
                        route: 'ThemeSettings',
                        icon: 'moon',
                        title: t('settings.main.theme_title'),
                    },
                ],
            },
            {
                title: t('settings.main.support_section'),
                items: [
                    {
                        icon: 'feedback',
                        title: t('settings.main.get_help_title'),
                        url: config.supportBaseUrl,
                    },
                    {
                        icon: 'star',
                        title: t('settings.main.rate_title'),
                    },
                    {
                        icon: 'text-document',
                        title: t('settings.main.terms_title'),
                        url: config.termsOfServiceUrl,
                    },
                    {
                        icon: 'text-document',
                        title: t('settings.main.privacy_title'),
                        url: config.privacyPolicyUrl,
                    },
                    {
                        route: 'DeveloperSettings',
                        icon: 'code',
                        title: t('settings.main.developer_title'),
                    },
                ],
            },
        ],
        [t],
    )

    const handleDeleteAllAccounts = () => {
        clearAllData()
        close()
    }

    const appVersion = useMemo(() => {
        return getAppVersion()
    }, [getAppVersion])

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
            <Text style={styles.versionText}>
                {t('settings.main.version_footer', { version: appVersion })}
            </Text>
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
