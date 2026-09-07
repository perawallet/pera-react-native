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

import type { PropsWithChildren } from 'react'
import { WalletConnectErrorBoundary } from '@modules/walletconnect/components/BaseErrorBoundary/WalletConnectErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { useWalletConnectProvider } from './useWalletConnectProvider'

export type WalletConnectProviderProps = {} & PropsWithChildren

export function WalletConnectProvider({
    children,
}: WalletConnectProviderProps) {
    const { t } = useLanguage()
    // Effect-driven sheet management lives in the hook; we just need to
    // initialise it so the lifecycle effects run alongside the provider.
    useWalletConnectProvider()

    return (
        <WalletConnectErrorBoundary t={t}>
            {children}
        </WalletConnectErrorBoundary>
    )
}
