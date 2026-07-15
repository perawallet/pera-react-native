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

import { useCallback, useEffect, useMemo, useState } from 'react'
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

/**
 * App-level wrapper around the core useLedgerConnection hook.
 * Resolves all Ledger transport providers from the registry, filters
 * to the ones supported on this platform (BLE on iOS+Android, USB on
 * Android only), and passes them to the core hook.
 *
 * The supported-providers list is computed with local state instead of
 * React Query. The provider objects expose methods (`scan`, `connect`,
 * `isSupported`) and the `PersistQueryClientProvider` wired up at the
 * root of the app would serialize a query result via `JSON.stringify`,
 * silently stripping those methods and leaving consumers with plain
 * `{ manufacturer, transportType }` shells that throw at call time.
 */
export const useLedgerConnection = (): UseLedgerConnectionWrapperResult => {
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
                        // platform (e.g. Android-only USB on iOS) — treat
                        // a thrown isSupported as unsupported rather than
                        // letting it bubble up as an unhandled rejection.
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

    const core = useLedgerConnectionCore(supportedProviders)

    // Stable no-op so consumers that put `startScan` in an effect dep array
    // don't re-run their effects on every render of this hook.
    const noopStartScan = useCallback(() => {}, [])

    return {
        ...core,
        // Suppress scanning until the support check has resolved. Without
        // this guard, the very first `startScan()` runs against an empty
        // provider list, briefly transitioning the UI through 'scanning'
        // → 'disconnected' → 'scanning' as the query resolves.
        startScan: isReady ? core.startScan : noopStartScan,
        isReady,
    }
}
