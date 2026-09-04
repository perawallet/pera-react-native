/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { config } from '@perawallet/wallet-core-config'

import { PWListItem, PWScreen } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview/hooks'
import { routeCapabilities } from '@routes/capabilities'

export const SettingsDeveloperMenuScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const openTestingDapp = () => {
        pushWebView({
            url: config.peraDemoDappUrl,
            id: 'Testing Dapp',
            enablePeraConnect: true,
        })
    }

    const handleTapEvent = (page: string) => {
        navigation.push(page)
    }

    return (
        <PWScreen>
            <PWListItem
                onPress={() => handleTapEvent('FeatureFlags')}
                icon='sliders'
                title={t('screens.feature_flags')}
            />
            <PWListItem
                onPress={() => handleTapEvent('MigrationViewer')}
                icon='code'
                title='Migration Viewer'
            />
            <PWListItem
                onPress={() => handleTapEvent('KeystoreMigrations')}
                icon='reload'
                title='Keystore Migrations'
            />
            <PWListItem
                onPress={() => openTestingDapp()}
                icon='globe'
                title={t('settings.developer.debug_dapp')}
            />
            <PWListItem
                onPress={() => handleTapEvent('ManageCache')}
                icon='reload'
                title={t('settings.developer.manage_cache')}
            />
            <PWListItem
                onPress={() => handleTapEvent('AppIntegrity')}
                icon='shield-check'
                title={t('settings.developer.app_integrity')}
            />
            <PWListItem
                onPress={() => handleTapEvent('Gallery')}
                icon='dot-stack'
                title={t('settings.developer.screen_gallery')}
                testID='developer_menu_gallery_item'
            />
            {routeCapabilities.passwordManager && (
                <PWListItem
                    onPress={() => handleTapEvent('PasswordList')}
                    icon='key'
                    title={t('settings.passwords.title')}
                    testID='developer_menu_passwords_item'
                />
            )}
        </PWScreen>
    )
}
