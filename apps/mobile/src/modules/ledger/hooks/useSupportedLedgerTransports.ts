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

import { useEffect, useMemo, useState } from 'react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type {
    HardwareWalletTransportProvider,
    LedgerTransportType,
} from '@perawallet/wallet-core-hardware-wallet'

export type UseSupportedLedgerTransportsResult = {
    /** True once every provider's `isSupported()` has resolved. */
    isReady: boolean
    supportedProviders: HardwareWalletTransportProvider[]
    supportedTransportTypes: LedgerTransportType[]
}

// Local state rather than React Query: the persisted query cache would
// JSON-serialize the providers and strip their methods (`scan`, `connect`).
export const useSupportedLedgerTransports =
    (): UseSupportedLedgerTransportsResult => {
        const allLedgerProviders = useMemo<HardwareWalletTransportProvider[]>(
            () =>
                getProvider().hardwareWalletRegistry.getProvidersByManufacturer(
                    'ledger',
                ),
            [],
        )

        const [supportedProviders, setSupportedProviders] = useState<
            HardwareWalletTransportProvider[]
        >([])
        const [isReady, setIsReady] = useState(false)

        useEffect(() => {
            let cancelled = false
            void (async () => {
                const results = await Promise.all(
                    allLedgerProviders.map(async provider => {
                        try {
                            return {
                                provider,
                                supported: await provider.isSupported(),
                            }
                        } catch {
                            // A provider's native module may be absent on this
                            // platform (e.g. Android-only USB on iOS).
                            return { provider, supported: false }
                        }
                    }),
                )
                if (cancelled) return
                setSupportedProviders(
                    results.filter(r => r.supported).map(r => r.provider),
                )
                setIsReady(true)
            })()
            return () => {
                cancelled = true
            }
        }, [allLedgerProviders])

        const supportedTransportTypes = useMemo(
            () => [...new Set(supportedProviders.map(p => p.transportType))],
            [supportedProviders],
        )

        return { isReady, supportedProviders, supportedTransportTypes }
    }
