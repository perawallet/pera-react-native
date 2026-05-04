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

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useLedgerConnection as useLedgerConnectionCore,
    type UseLedgerConnectionResult,
} from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransportProvider } from '@perawallet/wallet-core-hardware-wallet'

type UseLedgerConnectionWrapperResult = UseLedgerConnectionResult & {
    /** True once each provider's `isSupported()` has resolved. */
    isReady: boolean
}

const ledgerSupportedProvidersQueryKey = ['ledger', 'supported-providers']

/**
 * App-level wrapper around the core useLedgerConnection hook.
 * Resolves all Ledger transport providers from the registry, filters
 * to the ones supported on this platform (BLE on iOS+Android, USB on
 * Android only), and passes them to the core hook.
 */
export const useLedgerConnection = (): UseLedgerConnectionWrapperResult => {
    const allLedgerProviders = useMemo<HardwareWalletTransportProvider[]>(
        () =>
            getProvider().hardwareWalletRegistry.getProvidersByManufacturer(
                'ledger',
            ),
        [],
    )

    const { data: supportedProviders = [], isSuccess } = useQuery({
        queryKey: ledgerSupportedProvidersQueryKey,
        queryFn: async () => {
            const results = await Promise.all(
                allLedgerProviders.map(async provider => {
                    try {
                        return {
                            provider,
                            supported: await provider.isSupported(),
                        }
                    } catch {
                        // A provider's native module may be absent on this
                        // platform (e.g. Android-only USB on iOS) — treat
                        // a thrown isSupported as unsupported rather than
                        // letting it bubble up as an unhandled rejection.
                        return { provider, supported: false }
                    }
                }),
            )
            return results.filter(r => r.supported).map(r => r.provider)
        },
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
    })

    const core = useLedgerConnectionCore(supportedProviders)

    return {
        ...core,
        // Suppress scanning until the support query has resolved. Without
        // this guard, the very first `startScan()` runs against an empty
        // provider list, briefly transitioning the UI through 'scanning'
        // → 'disconnected' → 'scanning' as the query resolves.
        startScan: isSuccess ? core.startScan : () => {},
        isReady: isSuccess,
    }
}
