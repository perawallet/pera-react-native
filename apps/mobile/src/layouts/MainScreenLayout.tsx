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
import { useStyles } from './MainScreenLayout.style'
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context'
import PWView from '../components/common/view/PWView'

export type MainScreenLayoutProps = {
    fullScreen?: boolean
    header?: boolean
} & ViewProps

export type MainScreenLayoutPropsWithInsets = {
    insets: EdgeInsets
} & MainScreenLayoutProps

//TODO: Make this a proper layout system with slots as needed
const MainScreenLayout = (props: MainScreenLayoutProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ ...props, insets })

    return (
        <PWView
            style={styles.contentContainer}
            {...props}
        >
            {props.children}
        </PWView>
    )
}

export default MainScreenLayout
