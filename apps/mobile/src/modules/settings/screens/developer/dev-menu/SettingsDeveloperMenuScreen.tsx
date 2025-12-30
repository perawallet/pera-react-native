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

import PWView from '@components/view/PWView'
import { useLanguage } from '@hooks/language'
import { useWebView } from '@hooks/webview'
import PWListItem from '@components/list-item/PWListItem'
import { config } from '@perawallet/wallet-core-config'
import { useStyles } from './styles'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ParamListBase, useNavigation } from '@react-navigation/native'

const SettingsDeveloperMenuScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const openTestingWebview = () => {
        pushWebView({
            url: config.onrampBaseUrl + 'test',
            id: 'Testing Webview',
            enablePeraConnect: true,
        })
    }

    const handleTapEvent = (page: string) => {
        navigation.push(page)
    }

    return (
        <PWView style={styles.container}>
            <PWListItem
                onPress={() => handleTapEvent('FeatureFlags')}
                icon='sliders'
                title={t('screens.feature_flags')}
            />
            <PWListItem
                onPress={() => openTestingWebview()}
                icon='globe'
                title={t('settings.developer.debug_webview')}
            />
        </PWView>
    )
}

export default SettingsDeveloperMenuScreen
