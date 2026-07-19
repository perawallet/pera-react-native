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
import { useTestnetIndicator } from './useTestnetIndicator'
import { useStyles } from './styles'

// Web/extension equivalent of native's full-width testnet bar
// (components/RootComponent/RootComponent.tsx). Mounted once at the app
// shell root (AppShell.web.tsx) so it covers every screen in both the popup
// and expanded-tab surfaces without being added per-screen.
export const TestnetIndicator = () => {
    const { isVisible, label } = useTestnetIndicator()
    const styles = useStyles()

    if (!isVisible) return null

    return (
        <PWView
            style={styles.container}
            pointerEvents='box-none'
            testID='testnet_indicator'
        >
            <PWView
                style={styles.badge}
                pointerEvents='none'
            >
                <PWText style={styles.text}>{label}</PWText>
            </PWView>
        </PWView>
    )
}
