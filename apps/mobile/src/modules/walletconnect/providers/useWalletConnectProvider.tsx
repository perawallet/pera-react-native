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
import { useEffect, useRef, useState } from 'react'
import { generateUniqueId, type Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { ConnectionView } from '../components/ConnectionView/ConnectionView'
import { ConnectionSuccessContent } from '../components/ConnectionSuccessContent'
import { WalletConnectErrorContent } from '../components/WalletConnectErrorContent'

export const useWalletConnectProvider = () => {
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
    const { request: requestBottomSheet, dismiss } = useBottomSheet()
    const successOpenRef = useRef(false)
    const errorOpenRef = useRef(false)
    const connectionSheetIdRef = useRef<Nullable<string>>(null)

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

    const shouldShowConnection =
        !!nextRequest && !successRequest && !connectionError

    useEffect(() => {
        if (shouldShowConnection && !connectionSheetIdRef.current) {
            const id = generateUniqueId()
            connectionSheetIdRef.current = id
            void requestBottomSheet({
                id,
                contents: (
                    <ConnectionView
                        request={nextRequest!}
                        onSuccess={handleSuccess}
                        onError={handleConnectionError}
                    />
                ),
                options: {
                    size: 'modal',
                    enableCloseOnBackdropPress: false,
                    autoCreateContainer: false,
                },
            }).finally(() => {
                connectionSheetIdRef.current = null
            })
        } else if (!shouldShowConnection && connectionSheetIdRef.current) {
            const id = connectionSheetIdRef.current
            connectionSheetIdRef.current = null
            dismiss(id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sheet open/close only
    }, [shouldShowConnection])

    useEffect(() => {
        if (!successRequest || successOpenRef.current) return
        successOpenRef.current = true
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: <ConnectionSuccessContent request={successRequest} />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            successOpenRef.current = false
            setSuccessRequest(null)
        })()
        return () => {
            cancelled = true
        }
    }, [successRequest, requestBottomSheet])

    useEffect(() => {
        if (!connectionError || errorOpenRef.current) return
        errorOpenRef.current = true
        let cancelled = false
        void (async () => {
            await requestBottomSheet<void>({
                contents: <WalletConnectErrorContent error={connectionError} />,
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            errorOpenRef.current = false
            if (nextRequest) {
                removeSessionRequest(nextRequest)
            }
            setConnectionError(null)
        })()
        return () => {
            cancelled = true
        }
    }, [
        connectionError,
        requestBottomSheet,
        nextRequest,
        removeSessionRequest,
        setConnectionError,
    ])

    return {
        nextRequest,
        successRequest,
        connectionError,
        handleConnectionError,
        handleSuccess,
    }
}
