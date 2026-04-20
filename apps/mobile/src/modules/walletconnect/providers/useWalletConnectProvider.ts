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
    useWalletConnectSessionRequests,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { useCallback, useEffect, useState } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'

export const useWalletConnectProvider = () => {
    const { sessionRequests, removeSessionRequest } =
        useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const [successRequest, setSuccessRequest] =
        useState<Nullable<WalletConnectSessionRequest>>(null)
    const [connectionError, setConnectionError] =
        useState<Nullable<Error>>(null)
    const { network } = useNetwork()

    const handleSigningError = useCallback((error: Error) => {
        setConnectionError(error)
    }, [])

    const handleSuccess = (request: WalletConnectSessionRequest) => {
        setSuccessRequest(request)
    }

    const clearSuccessRequest = () => {
        setSuccessRequest(null)
    }

    const handleConnectionError = (error?: Error) => {
        if (error) {
            setConnectionError(error)
        }
    }

    const clearConnectionError = () => {
        if (nextRequest) {
            removeSessionRequest(nextRequest)
        }
        setConnectionError(null)
    }

    const { initWalletConnect } = useWalletConnect(network, {
        onError: handleSigningError,
    })

    useEffect(() => {
        initWalletConnect()
    }, [initWalletConnect, network])

    return {
        nextRequest,
        successRequest,
        connectionError,
        handleConnectionError,
        handleSuccess,
        clearSuccessRequest,
        clearConnectionError,
    }
}
