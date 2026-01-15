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

import { ViewProps } from 'react-native'
import { useStyles } from './SafeAreaLayout.style'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWView } from '@components/core/PWView'
import { useDeeplinkListener } from '@hooks/deeplink'

export type SafeAreaLayoutProps = ViewProps

export const SafeAreaLayout = (props: SafeAreaLayoutProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)

    // this hook sets up the deeplink listener
    useDeeplinkListener()

    return (
        <PWView
            style={styles.contentContainer}
            {...props}
        >
            {props.children}
        </PWView>
    )
}
