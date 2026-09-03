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

import { createContext, useContext, useRef } from 'react'
import type { PeraProvider } from './pera-provider'
import { getProvider } from './singleton'

const PeraWalletContext = createContext<PeraProvider | null>(null)

interface PeraWalletProviderProps {
    children: React.ReactNode
}

/**
 * React Context Provider that creates the PeraProvider instance and registers
 * it with the module singleton. The provider is created synchronously on first
 * render via useRef, so both the React context and getProvider() singleton are
 * available before any useEffect runs.
 *
 * Stores are eagerly initialized at module scope via platform resource
 * singletons — no onProviderReady callback is needed.
 */
export const PeraWalletProvider = ({ children }: PeraWalletProviderProps) => {
    const providerRef = useRef<PeraProvider | null>(null)

    if (providerRef.current === null) {
        providerRef.current = getProvider()
    }

    return (
        <PeraWalletContext.Provider value={providerRef.current}>
            {children}
        </PeraWalletContext.Provider>
    )
}

/**
 * Returns the typed PeraProvider instance from React Context.
 * Must be used within a PeraWalletProvider.
 */
export const usePeraProvider = (): PeraProvider => {
    const provider = useContext(PeraWalletContext)
    if (!provider) {
        throw new Error(
            'usePeraProvider must be used within a PeraWalletProvider',
        )
    }
    return provider
}
