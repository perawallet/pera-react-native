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
import { PWIcon, PWView } from '@components/core'
import { useStyles } from './styles'
import { PairSelectionPanel } from '@modules/swap/components/PairSelectionPanel/PairSelectionPanel'
import { SwapHistoryPanel } from '@modules/swap/components/SwapHistoryPanel/SwapHistoryPanel'
import { TopPairsPanel } from '@modules/swap/components/TopPairsPanel/TopPairsPanel'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { config } from '@perawallet/wallet-core-config'

export const SwapScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const openSwapSupport = () => {
        pushWebView({
            url: config.swapSupportUrl,
            id: 'swap-support',
        })
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.headerContainer}>
                <PWView style={styles.titleContainer}>
                    <Text
                        h3
                        h3Style={styles.titleText}
                    >
                        {t('tabbar.swap')}
                    </Text>
                    <PWIcon
                        name='info'
                        style={styles.titleIcon}
                        onPress={openSwapSupport}
                    />
                </PWView>
                <AccountSelection />
            </PWView>
            <PairSelectionPanel />
            <SwapHistoryPanel />
            <TopPairsPanel />
        </PWView>
    )
}
