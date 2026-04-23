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

import { useState, useCallback } from 'react'
import type {
    LedgerAccount,
    LedgerTransport,
} from '@perawallet/wallet-extension-ledger-react-native/protocol'
import { discoverLedgerAccounts } from '../discovery'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseLedgerAccountsResult = {
    accounts: LedgerAccount[]
    isDiscovering: boolean
    progress: { current: number; total: Nullable<number> }
    error: Nullable<Error>
    discover: (transport: LedgerTransport) => Promise<LedgerAccount[]>
    retry: () => void
}

/**
 * Hook that manages Ledger account discovery.
 * Wraps the platform-agnostic discoverLedgerAccounts function
 * with state management for the UI.
 */
export const useLedgerAccounts = (): UseLedgerAccountsResult => {
    const [accounts, setAccounts] = useState<LedgerAccount[]>([])
    const [isDiscovering, setIsDiscovering] = useState(false)
    const [progress, setProgress] = useState<{
        current: number
        total: Nullable<number>
    }>({ current: 0, total: null })
    const [error, setError] = useState<Nullable<Error>>(null)
    const [lastTransport, setLastTransport] =
        useState<Nullable<LedgerTransport>>(null)

    const discover = useCallback(
        async (transport: LedgerTransport): Promise<LedgerAccount[]> => {
            setLastTransport(transport)
            setIsDiscovering(true)
            setError(null)
            setProgress({ current: 0, total: null })
            setAccounts([])

            try {
                const discovered = await discoverLedgerAccounts({
                    transport,
                    onProgress: (index: number) => {
                        setProgress({ current: index + 1, total: null })
                    },
                })

                setAccounts(discovered)
                return discovered
            } catch (err) {
                const discoverError =
                    err instanceof Error ? err : new Error(String(err))
                setError(discoverError)
                throw discoverError
            } finally {
                setIsDiscovering(false)
            }
        },
        [],
    )

    const retry = useCallback(() => {
        if (lastTransport) {
            discover(lastTransport)
        }
    }, [lastTransport, discover])

    return {
        accounts,
        isDiscovering,
        progress,
        error,
        discover,
        retry,
    }
}
