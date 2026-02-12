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

import { useRoute, type RouteProp } from '@react-navigation/native'
import { PWView } from '@components/core'
import { PWWebView } from '@modules/webview/components/PWWebView'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { RootStackParamList } from '@routes/types'
import { useStyles } from './styles'

type StakingDAppRouteProp = RouteProp<RootStackParamList, 'StakingDApp'>

export const StakingDAppScreen = () => {
    const styles = useStyles()
    const navigation = useAppNavigation()
    const route = useRoute<StakingDAppRouteProp>()

    const handleClose = () => {
        navigation.goBack()
    }

    return (
        <PWView style={styles.container}>
            <PWWebView
                url={route.params.url}
                enablePeraConnect={true}
                showControls={true}
                style={styles.webview}
                containerStyle={styles.webview}
                onClose={handleClose}
            />
        </PWView>
    )
}
