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

import React from 'react'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { useDappRequest } from '../../hooks/useDappRequest.web'
import { PasskeyApprovalScreen } from '../../screens/PasskeyApprovalScreen'
import { SignRequestApprovalScreen } from '../../screens/SignRequestApprovalScreen'
import { WcConnectScreen } from '../../screens/WcConnectScreen'
import { WcErrorScreen } from '../../screens/WcErrorScreen'

// Routes on `approval.kind` rather than a react-navigation stack: each kind
// is a self-contained flow, so there is nothing to navigate between.
export const DappRequestSurface = (): React.JSX.Element => {
    const { approval, isLoading } = useDappRequest()

    if (isLoading || !approval) {
        return <FullScreenLoadingView />
    }

    switch (approval.kind) {
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
        // The pairing handshake, unlike 'connection-request' above, which is
        // one operation on a connection that already exists.
        case 'connection-proposal': {
            return <WcConnectScreen />
        }
        // The bridge is versioned independently of this bundle; an unknown
        // kind holds the spinner rather than rendering a blank window.
        default: {
            return <FullScreenLoadingView />
        }
    }
}
