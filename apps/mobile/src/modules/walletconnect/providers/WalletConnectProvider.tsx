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

import React, { PropsWithChildren, useEffect, useRef } from 'react'
import { PWBottomSheet } from '@components/core'
import { ConnectionView } from '@modules/walletconnect/components/ConnectionView/ConnectionView'

import { WalletConnectErrorBoundary } from '@modules/walletconnect/components/BaseErrorBoundary/WalletConnectErrorBoundary'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { ConnectionSuccessContent } from '../components/ConnectionSuccessContent'
import { WalletConnectErrorContent } from '../components/WalletConnectErrorContent'
import { useWalletConnectProvider } from './useWalletConnectProvider'

export type WalletConnectProviderProps = {} & PropsWithChildren

export function WalletConnectProvider({
    children,
}: WalletConnectProviderProps) {
    const { t } = useLanguage()
    const {
        nextRequest,
        successRequest,
        connectionError,
        handleConnectionError,
        handleSuccess,
        clearSuccessRequest,
        clearConnectionError,
    } = useWalletConnectProvider()

    const { request: requestBottomSheet } = useBottomSheet()
    const successOpenRef = useRef(false)
    const errorOpenRef = useRef(false)

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
            clearSuccessRequest()
        })()
        return () => {
            cancelled = true
        }
    }, [successRequest, requestBottomSheet, clearSuccessRequest])

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
            clearConnectionError()
        })()
        return () => {
            cancelled = true
        }
    }, [connectionError, requestBottomSheet, clearConnectionError])

    return (
        <WalletConnectErrorBoundary t={t}>
            {children}
            <PWBottomSheet
                size='lg'
                isVisible={!!nextRequest && !successRequest && !connectionError}
                autoCreateContainer={false}
            >
                {!!nextRequest && (
                    <ConnectionView
                        request={nextRequest}
                        onSuccess={handleSuccess}
                        onError={handleConnectionError}
                    />
                )}
            </PWBottomSheet>
        </WalletConnectErrorBoundary>
    )
}
