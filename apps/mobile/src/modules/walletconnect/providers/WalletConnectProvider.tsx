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
import { useToast } from '@hooks/useToast'
import { ConnectionSuccessBottomSheet } from '../components/ConnectionSuccessBottomSheet/ConnectionSuccessBottomSheet'
import { LONG_NOTIFICATION_DURATION } from '@constants/ui'

export type WalletConnectProviderProps = {} & PropsWithChildren

export function WalletConnectProvider({
    children,
}: WalletConnectProviderProps) {
    const { sessionRequests } = useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const { height } = useWindowDimensions()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const [successRequest, setSuccessRequest] =
        useState<WalletConnectSessionRequest | null>(null)

    const handleSigningError = useCallback(
        (error: Error) => {
            showToast(
                {
                    title: t('errors.signing.title'),
                    body: t(error.message),
                    type: 'error',
                },
                {
                    duration: LONG_NOTIFICATION_DURATION,
                },
            )
        },
        [showToast, t],
    )

    const handleSuccess = (request: WalletConnectSessionRequest) => {
        setSuccessRequest(request)
    }

    const clearSuccessRequest = () => {
        setSuccessRequest(null)
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
                isVisible={!!nextRequest && !successRequest}
            >
                {!!nextRequest && (
                    <ConnectionView
                        request={nextRequest}
                        onSuccess={handleSuccess}
                        onError={() => {}}
                    />
                )}
            </PWBottomSheet>

            <ConnectionSuccessBottomSheet
                onClose={clearSuccessRequest}
                request={successRequest}
            />
        </WalletConnectErrorBoundary>
    )
}
