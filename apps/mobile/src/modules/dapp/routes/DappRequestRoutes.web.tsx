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

// The approval popup (approval.html) is its own top-level document — never a
// sibling of the popup/expanded-tab's own NavigationContainer — so this tree
// is wrapped in NavigationIndependentTree rather than sharing a ref/container
// with WebMainRoutes (which only ever mounts in the popup/expanded surfaces).
// SignRequestView (mounted by SignRequestApprovalScreen) nests its OWN
// independent tree inside this one for the signing stack — nesting
// NavigationIndependentTree is supported by react-navigation.
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
// is its own self-contained flow (EnableRequestScreen owns its
// approve/reject; SignRequestApprovalScreen hands off sign-transactions,
// sign-message, AND wc-sign requests to the shared signing pipeline), so
// there's nothing to navigate between within a single approval window.
const DappRequestSurface = (): React.JSX.Element => {
    const { approval, isLoading } = useDappRequest()

    if (isLoading || !approval) {
        return <FullScreenLoadingView />
    }

    switch (approval.kind) {
        case 'sign-transactions':
        case 'sign-message':
        case 'wc-sign': {
            return <SignRequestApprovalScreen />
        }
        case 'passkey-create':
        case 'passkey-get': {
            return <PasskeyApprovalScreen />
        }
        // Notification-only: nothing is pending on the socket (the host
        // already answered the peer), so this screen just explains the
        // refusal and settles the approval to close the window.
        case 'wc-error': {
            return <WcErrorScreen />
        }
        // 'wc-connect' has its own screen (the web twin of mobile's
        // ConnectionView) rather than sharing 'enable's: a WalletConnect
        // handshake carries peer metadata and a requested permission set that
        // ARC-0027's enable request has no equivalent of, and the wallet
        // already had an established look for presenting them. Both still
        // settle through the same bridge — resolveApproval/rejectApproval
        // don't branch on `kind` (ApprovalWindowBridge.finish doesn't either).
        case 'wc-connect': {
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
                {/* flex:1 bounds the surface to the popup viewport (see
                    styles.ts) so a tall sign screen scrolls instead of
                    overflowing the fixed-height toolbar popup. */}
                <PWView style={styles.surface}>
                    <DappRequestSurface />
                </PWView>
                {/* Hardware signing runs in THIS window, so its sheets need a
                    manager here — the shell mounts one per branch and the
                    dapp-request branch had none. Only the Ledger slice of
                    SigningOverlays: see LedgerSigningOverlays for why the
                    full set would double up the review sheet. */}
                <BottomSheetManager />
                <LedgerSigningOverlays />
            </NavigationContainer>
        </NavigationIndependentTree>
    )
}
