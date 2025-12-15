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

import { config } from '@perawallet/wallet-core-config'
import PWWebView from '@components/webview/PWWebView'
import { useStyles } from './styles'
import PWView from '@components/common/view/PWView'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const StakingScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const url = config.stakingBaseUrl

    return (
        <PWView style={styles.container}>
            <PWWebView
                url={url}
                enablePeraConnect={true}
                style={styles.webview}
                containerStyle={styles.webview}
            />
        </PWView>
    )
}

export default StakingScreen
