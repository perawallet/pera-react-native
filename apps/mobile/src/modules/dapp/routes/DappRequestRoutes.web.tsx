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
import { LedgerSigningOverlays } from '@modules/signing/components/SigningOverlays'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getNavigationTheme } from '@theme/theme'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { useDappRequest } from '../hooks/useDappRequest.web'
import { EnableRequestScreen } from '../screens/EnableRequestScreen'
import { PasskeyApprovalScreen } from '../screens/PasskeyApprovalScreen'
import { SignRequestApprovalScreen } from '../screens/SignRequestApprovalScreen'
import { WcConnectScreen } from '../screens/WcConnectScreen'
import { WcErrorScreen } from '../screens/WcErrorScreen'
import { useStyles } from './styles'

// Routes on `approval.kind` rather than a react-navigation stack: each kind
// is a self-contained flow, so there is nothing to navigate between.
const DappRequestSurface = (): React.JSX.Element => {
    const { approval, isLoading } = useDappRequest()

    if (isLoading || !approval) {
        return <FullScreenLoadingView />
    }

    switch (approval.kind) {
        case 'sign-transactions':
        case 'sign-message':
        case 'connection-request': {
            return <SignRequestApprovalScreen />
        }
        case 'passkey-create':
        case 'passkey-get': {
            return <PasskeyApprovalScreen />
        }
        // Notification-only: the host already refused the peer; the screen
        // explains why and settles the approval to close the window.
        case 'connection-error': {
            return <WcErrorScreen />
        }
        // Carries peer metadata and a requested permission set that an
        // ARC-0027 enable has no equivalent of.
        case 'connection-proposal': {
            return <WcConnectScreen />
        }
        case 'enable':
        default: {
            return <EnableRequestScreen />
        }
    }
}

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
