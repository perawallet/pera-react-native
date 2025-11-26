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
import MainScreenLayout from '../../../layouts/MainScreenLayout'

import PWView from '../../../components/common/view/PWView'
import PWButton from '../../../components/common/button/PWButton'
import { useStyles } from './SettingsScreen.styles'
import { ScrollView } from 'react-native'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'
import { useMemo, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import PWTouchableOpacity from '../../../components/common/touchable-opacity/PWTouchableOpacity'
import PWIcon, { IconName } from '../../../components/common/icons/PWIcon'

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
                route: 'GetHelpSettings',
                icon: 'feedback',
                title: 'Get Help',
            },
            {
                icon: 'star',
                title: 'Rate Pera Wallet',
            },
            {
                route: 'TermsAndServicesSettings',
                icon: 'text-document',
                title: 'Terms and Services',
            },
            {
                route: 'PrivacyPolicySettings',
                icon: 'text-document',
                title: 'Privacy Policy',
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
    const [_, setRatingOpen] = useState(false)

    const appVersion = useMemo(() => {
        return getAppVersion()
    }, [getAppVersion])

    const goToSettingsPage = (route: string, title: string) => {
        navigation.push(route, { title })
    }

    const openRating = () => {
        setRatingOpen(true)
    }

    return (
        <MainScreenLayout fullScreen>
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
                            <Text style={styles.sectionTitle}>
                                {item.title}
                            </Text>
                            {item.items.map(page => (
                                <PWTouchableOpacity
                                    style={styles.sectionRow}
                                    key={`settings-sectionrow-${page.title}`}
                                    onPress={() => {
                                        page.route
                                            ? goToSettingsPage(
                                                page.route,
                                                page.title,
                                            )
                                            : openRating()
                                    }}
                                >
                                    <PWIcon name={page.icon as IconName} />
                                    <Text style={styles.sectionRowTitle}>
                                        {page.title}
                                    </Text>
                                    <PWIcon
                                        name='chevron-right'
                                        variant='secondary'
                                    />
                                </PWTouchableOpacity>
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
        </MainScreenLayout>
    )
}

export default SettingsScreen
