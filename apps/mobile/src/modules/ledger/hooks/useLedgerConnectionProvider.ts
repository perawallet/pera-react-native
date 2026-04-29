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

import { useEffect, useMemo, useState } from 'react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useLedgerConnection as useLedgerConnectionCore } from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransportProvider } from '@perawallet/wallet-core-hardware-wallet'

/**
 * App-level wrapper around the core useLedgerConnection hook.
 * Resolves all Ledger transport providers from the registry, filters
 * to the ones supported on this platform (BLE on iOS+Android, USB on
 * Android only), and passes them to the core hook.
 */
export const useLedgerConnection = () => {
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

    useEffect(() => {
        let cancelled = false
        Promise.all(
            allLedgerProviders.map(async p => ({
                provider: p,
                supported: await p.isSupported(),
            })),
        ).then(results => {
            if (cancelled) return
            setSupportedProviders(
                results.filter(r => r.supported).map(r => r.provider),
            )
        })
        return () => {
            cancelled = true
        }
    }, [allLedgerProviders])

    return useLedgerConnectionCore(supportedProviders)
}
