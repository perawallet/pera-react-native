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

import { PWText, PWView } from '@components/core'
import { useTestnetIndicator } from './useTestnetIndicator.web'
import { useStyles } from './styles.web'

// Web/extension equivalent of native's full-width testnet bar
// (components/RootComponent/RootComponent.tsx). Mounted once as the first
// child of the app-shell card (AppShell.web.tsx): the bar takes real layout
// height so screen titles can never collide with it, and the
// frame paints thin testnetBg accents on the other three edges above screen
// content without blocking taps.
export const TestnetIndicator = () => {
    const { isVisible, label } = useTestnetIndicator()
    const styles = useStyles()

    if (!isVisible) return null

    return (
        <>
            <PWView
                style={styles.bar}
                testID='testnet_indicator'
            >
                <PWText style={styles.text}>{label}</PWText>
            </PWView>
            <PWView
                style={styles.frame}
                pointerEvents='none'
                testID='testnet_indicator_frame'
            />
        </>
    )
}
