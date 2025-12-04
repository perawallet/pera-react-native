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

import { Text } from '@rneui/themed'

import PWView from '../../../components/common/view/PWView'
import PWButton from '../../../components/common/button/PWButton'
import { useStyles } from './SettingsScreen.styles'
import { ScrollView } from 'react-native'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { useContext, useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconName } from '../../../components/common/icons/PWIcon'
import { config } from '@perawallet/wallet-core-config'
import { WebViewContext } from '../../../providers/WebViewProvider'
import PWListItem from '../../../components/common/list-item/PWListItem'

//TODO: add ratings view handling
const settingsOptions = [
    {
        title: 'Account',
        items: [
            {
                route: 'SecuritySettings',
                icon: 'shield-check',
                title: 'Security',
            },
            {
                route: 'NotificationsSettings',
                icon: 'bell',
                title: 'Notifications',
            },
            {
                route: 'WalletConnectSettings',
                icon: 'wallet-connect',
                title: 'WalletConnect Sessions',
            },
            {
                route: 'PasskeysSettings',
                icon: 'person-key',
                title: 'Passkeys',
            },
        ],
    },
    {
        title: 'App Preferences',
        items: [
            {
                route: 'CurrencySettings',
                icon: 'dollar',
                title: 'Currency',
            },
            {
                route: 'ThemeSettings',
                icon: 'moon',
                title: 'Theme',
            },
        ],
    },
    {
        title: 'Support',
        items: [
            {
                icon: 'feedback',
                title: 'Get Help',
                url: config.supportBaseUrl,
            },
            {
                icon: 'star',
                title: 'Rate Pera Wallet',
            },
            {
                icon: 'text-document',
                title: 'Terms and Services',
                url: config.termsOfServiceUrl,
            },
            {
                icon: 'text-document',
                title: 'Privacy Policy',
                url: config.privacyPolicyUrl,
            },
            {
                route: 'DeveloperSettings',
                icon: 'code',
                title: 'Developer Settings',
            },
        ],
    },
]

const SettingsScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { getAppVersion } = useDeviceInfoService()
    const { pushWebView } = useContext(WebViewContext)

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
                title='Remove All Accounts and Logout'
            />
            <Text style={styles.versionText}>
                Pera Wallet Version {appVersion}
            </Text>
        </ScrollView>
    )
}

export default SettingsScreen
