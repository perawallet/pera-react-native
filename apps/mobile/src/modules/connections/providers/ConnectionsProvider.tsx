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

import { type PropsWithChildren } from 'react'
import { WalletConnectErrorBoundary } from '@modules/walletconnect/components/BaseErrorBoundary/WalletConnectErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { ConnectionRegistryContext } from './connectionRegistryContext'
import { useConnectionsProvider } from './useConnectionsProvider'

export {
    useConnectionRegistry,
    useOptionalConnectionRegistry,
} from './connectionRegistryContext'

export type ConnectionsProviderProps = {} & PropsWithChildren

/**
 * Supplies the registry `useConnectionsProvider` owns to descendants via
 * `useConnectionRegistry`; the boot order lives in `useConnectionsBoot`.
 *
 * `WalletConnectErrorBoundary` is a generic render-crash guard with
 * WalletConnect-flavoured copy, which fits while v1 is the only handler.
 * `WalletConnectProvider` must not be mounted alongside this: the same v1
 * connectors would have two owners.
 */
export function ConnectionsProvider({ children }: ConnectionsProviderProps) {
    const { t } = useLanguage()
    const registry = useConnectionsProvider()

    return (
        <ConnectionRegistryContext.Provider value={registry}>
            <WalletConnectErrorBoundary t={t}>
                {children}
            </WalletConnectErrorBoundary>
        </ConnectionRegistryContext.Provider>
    )
}
