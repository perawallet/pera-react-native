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

import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useWalletConnect,
    useWalletConnectForegroundReconnect,
    useWalletConnectSessionRequests,
    useWalletConnectStore,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useEffect, useState } from 'react'
import { type Nullable } from '@perawallet/wallet-core-shared'
import {
    useConnectionRequestSheet,
    useConnectionResultSheet,
} from '@modules/connections/hooks'
import { ConnectionView } from '../components/ConnectionView/ConnectionView'
import { ConnectionSuccessSheet } from '@modules/connections/components/ConnectionSuccessSheet'
import { ConnectionErrorSheet } from '@modules/connections/components/ConnectionErrorSheet'

export type UseWalletConnectProviderResult = {
    nextRequest: WalletConnectSessionRequest | undefined
    successRequest: Nullable<WalletConnectSessionRequest>
    connectionError: Nullable<Error>
    handleConnectionError: (error?: Error) => void
    handleSuccess: (request: WalletConnectSessionRequest) => void
}

export const useWalletConnectProvider = (): UseWalletConnectProviderResult => {
    // Revive WalletConnect bridge sockets when the app returns to the
    // foreground — without this a backgrounded session silently drops
    // both outgoing signed responses and incoming dApp requests.
    useWalletConnectForegroundReconnect()

    const { sessionRequests, removeSessionRequest } =
        useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const [successRequest, setSuccessRequest] =
        useState<Nullable<WalletConnectSessionRequest>>(null)
    const { network } = useNetwork()
    const connectionError = useWalletConnectStore(
        state => state.connectionError,
    )
    const setConnectionError = useWalletConnectStore(
        state => state.setConnectionError,
    )

    const handleSuccess = (request: WalletConnectSessionRequest) => {
        setSuccessRequest(request)
    }

    const handleConnectionError = (error?: Error) => {
        if (error) {
            setConnectionError(error)
        }
        if (nextRequest) {
            removeSessionRequest(nextRequest)
        }
    }

    const { initWalletConnect } = useWalletConnect(network)

    useEffect(() => {
        initWalletConnect()
    }, [initWalletConnect, network])

    useConnectionRequestSheet({
        shouldShow: !!nextRequest && !successRequest && !connectionError,
        renderContents: () => (
            <ConnectionView
                request={nextRequest!}
                onSuccess={handleSuccess}
                onError={handleConnectionError}
            />
        ),
    })

    useConnectionResultSheet({
        isActive: !!successRequest,
        renderContents: () => (
            <ConnectionSuccessSheet
                name={successRequest?.peerMeta.name ?? ''}
            />
        ),
        onClose: () => setSuccessRequest(null),
    })

    useConnectionResultSheet({
        isActive: !!connectionError,
        renderContents: () => <ConnectionErrorSheet error={connectionError} />,
        onClose: () => {
            if (nextRequest) {
                removeSessionRequest(nextRequest)
            }
            setConnectionError(null)
        },
    })

    return {
        nextRequest,
        successRequest,
        connectionError,
        handleConnectionError,
        handleSuccess,
    }
}
