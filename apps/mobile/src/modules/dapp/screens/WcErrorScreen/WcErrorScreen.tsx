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

// Notification-only approval surface: tells the user why a WalletConnect
// handshake they started was refused. Reuses mobile's own
// WalletConnectErrorContent so the copy and layout cannot drift from the
// sheet mobile shows for the same class of failure — passing `onConfirm`
// switches that component to its sheet-free host (see its prop doc).
import React from 'react'
import { PWScreen } from '@components/core'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { WalletConnectErrorContent } from '@modules/walletconnect/components/WalletConnectErrorContent'
import { useWcErrorScreen } from './useWcErrorScreen'

export const WcErrorScreen = (): React.JSX.Element => {
    const { error, isLoading, handleAcknowledge } = useWcErrorScreen()

    if (isLoading || !error) {
        return <FullScreenLoadingView />
    }

    return (
        <PWScreen scroll='never'>
            <WalletConnectErrorContent
                error={error}
                onConfirm={handleAcknowledge}
                testID='wc-error-content'
            />
        </PWScreen>
    )
}
