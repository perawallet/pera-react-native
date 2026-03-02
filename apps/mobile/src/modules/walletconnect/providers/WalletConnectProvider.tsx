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

import React, {
    PropsWithChildren,
    useCallback,
    useEffect,
    useState,
} from 'react'
import { PWBottomSheet } from '@components/core'
import { useWindowDimensions } from 'react-native'
import { ConnectionView } from '@modules/walletconnect/components/ConnectionView/ConnectionView'
import {
    useWalletConnect,
    useWalletConnectSessionRequests,
    WalletConnectSessionRequest,
} from '@perawallet/wallet-core-walletconnect'
import { WalletConnectErrorBoundary } from '@modules/walletconnect/components/BaseErrorBoundary/WalletConnectErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { ConnectionSuccessBottomSheet } from '../components/ConnectionSuccessBottomSheet/ConnectionSuccessBottomSheet'
import { WalletConnectErrorBottomSheet } from '../components/WalletConnectErrorBottomSheet/WalletConnectErrorBottomSheet'
import { logger } from '@perawallet/wallet-core-shared'

export type WalletConnectProviderProps = {} & PropsWithChildren

export function WalletConnectProvider({
    children,
}: WalletConnectProviderProps) {
    const { sessionRequests, removeSessionRequest } =
        useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const { height } = useWindowDimensions()
    const { t } = useLanguage()
    const [successRequest, setSuccessRequest] =
        useState<WalletConnectSessionRequest | null>(null)
    const [connectionError, setConnectionError] = useState<Error | null>(null)

    const handleSigningError = useCallback((error: Error) => {
        logger.debug('Handling Error')
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

    const { initWalletConnect } = useWalletConnect({
        onError: handleSigningError,
    })

    useEffect(() => {
        initWalletConnect()
    }, [])

    return (
        <WalletConnectErrorBoundary t={t}>
            {children}
            <PWBottomSheet
                innerContainerStyle={{ height: height - 100 }}
                isVisible={!!nextRequest && !successRequest && !connectionError}
            >
                {!!nextRequest && (
                    <ConnectionView
                        request={nextRequest}
                        onSuccess={handleSuccess}
                        onError={handleConnectionError}
                    />
                )}
            </PWBottomSheet>

            <ConnectionSuccessBottomSheet
                onClose={clearSuccessRequest}
                request={successRequest}
            />

            <WalletConnectErrorBottomSheet
                isVisible={!!connectionError}
                error={connectionError}
                onClose={clearConnectionError}
            />
        </WalletConnectErrorBoundary>
    )
}
