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

// approval.html is its own top-level document, never a sibling of the popup's
// NavigationContainer, so this tree is a NavigationIndependentTree.
// SignRequestView nests its own independent tree inside it for the signing stack.
import React from 'react'
import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'
import { PWView } from '@components/core'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { LedgerSigningOverlays } from '@modules/signing/shell'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getNavigationTheme } from '@theme/theme'
import { useStyles } from './styles'
import { DappRequestSurface } from './DappRequestSurface'

export const DappRequestRoutes = (): React.JSX.Element => {
    const isDarkMode = useIsDarkMode()
    const styles = useStyles()

    return (
        <NavigationIndependentTree>
            <NavigationContainer
                theme={getNavigationTheme(isDarkMode ? 'dark' : 'light')}
            >
                {/* flex:1 bounds the surface to the popup viewport so a tall sign
                    screen scrolls instead of overflowing the fixed-height popup. */}
                <PWView style={styles.surface}>
                    <DappRequestSurface />
                </PWView>
                {/* Hardware signing runs in THIS window, so its sheets need a manager
                    here. Only the Ledger slice of SigningOverlays: the full set would
                    double up the review sheet (see LedgerSigningOverlays). */}
                <BottomSheetManager />
                <LedgerSigningOverlays />
            </NavigationContainer>
        </NavigationIndependentTree>
    )
}
