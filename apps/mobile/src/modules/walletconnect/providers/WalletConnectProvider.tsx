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

import React, { PropsWithChildren, useEffect } from 'react'
import PWBottomSheet from '@components/bottom-sheet/PWBottomSheet'
import { useWindowDimensions } from 'react-native'
import ConnectionView from '../components/connection-view/ConnectionView'
import {
    useWalletConnect,
    useWalletConnectSessionRequests,
} from '@perawallet/wallet-core-walletconnect'
import { logger } from '@perawallet/wallet-core-shared'
import { WalletConnectErrorBoundary } from '../components/error-boundaries/WalletConnectErrorBoundary'
import { useLanguage } from '@hooks/language'

type WalletConnectProviderProps = {} & PropsWithChildren

export function WalletConnectProvider({
    children,
}: WalletConnectProviderProps) {
    const { sessionRequests } = useWalletConnectSessionRequests()
    const nextRequest = sessionRequests.at(0)
    const { height } = useWindowDimensions()
    const { reconnectAllSessions } = useWalletConnect()
    const { t } = useLanguage()

    useEffect(() => {
        logger.debug('Reconnecting WalletConnect sessions')
        reconnectAllSessions()
    }, [])

    return (
        <WalletConnectErrorBoundary t={t}>
            {children}
            <PWBottomSheet
                innerContainerStyle={{ height: height - 100 }}
                isVisible={!!nextRequest}
            >
                {!!nextRequest && <ConnectionView request={nextRequest} />}
            </PWBottomSheet>
        </WalletConnectErrorBoundary>
    )
}
