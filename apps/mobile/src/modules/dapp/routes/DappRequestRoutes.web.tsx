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
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getNavigationTheme } from '@theme/theme'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { useDappRequest } from '../hooks/useDappRequest'
import { EnableRequestScreen } from '../screens/EnableRequestScreen'
import { PasskeyApprovalScreen } from '../screens/PasskeyApprovalScreen'
import { SignRequestApprovalScreen } from '../screens/SignRequestApprovalScreen'
import { useStyles } from './styles'

// Routes on `approval.kind` rather than a react-navigation stack: each kind
// is its own self-contained flow (EnableRequestScreen owns its
// approve/reject; SignRequestApprovalScreen hands off both sign-transactions
// and sign-message requests to the shared signing pipeline), so there's
// nothing to navigate between within a single approval window.
const DappRequestSurface = (): React.JSX.Element => {
    const { approval, isLoading } = useDappRequest()

    if (isLoading || !approval) {
        return <FullScreenLoadingView />
    }

    switch (approval.kind) {
        case 'sign-transactions':
        case 'sign-message': {
            return <SignRequestApprovalScreen />
        }
        case 'passkey-create':
        case 'passkey-get': {
            return <PasskeyApprovalScreen />
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
            </NavigationContainer>
        </NavigationIndependentTree>
    )
}
