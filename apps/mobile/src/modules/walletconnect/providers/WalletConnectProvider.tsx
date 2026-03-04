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

import React, { PropsWithChildren } from 'react'
import { PWBottomSheet } from '@components/core'
import { ConnectionView } from '@modules/walletconnect/components/ConnectionView/ConnectionView'

import { WalletConnectErrorBoundary } from '@modules/walletconnect/components/BaseErrorBoundary/WalletConnectErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { ConnectionSuccessBottomSheet } from '../components/ConnectionSuccessBottomSheet/ConnectionSuccessBottomSheet'
import { WalletConnectErrorBottomSheet } from '../components/WalletConnectErrorBottomSheet/WalletConnectErrorBottomSheet'
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
