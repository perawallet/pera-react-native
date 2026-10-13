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

import { useCallback, useMemo } from 'react'
import {
    useLedgerConnection as useLedgerConnectionCore,
    type UseLedgerConnectionResult,
} from '@perawallet/wallet-core-ledger'
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'
import { useSupportedLedgerTransports } from './useSupportedLedgerTransports'

type UseLedgerConnectionOptions = {
    /**
     * Restrict scanning to these transports. Lets the scan screen keep USB
     * HID discovery alive when the Bluetooth permission is denied (USB needs
     * no BLE permission). Omit to scan every supported transport.
     */
    transportTypes?: LedgerTransportType[]
}

type UseLedgerConnectionWrapperResult = UseLedgerConnectionResult & {
    /** True once each provider's `isSupported()` has resolved. */
    isReady: boolean
    /**
     * Transports supported on this platform (unfiltered by `transportTypes`),
     * so callers can decide e.g. whether a USB-only fallback scan exists.
     */
    supportedTransportTypes: LedgerTransportType[]
}

/**
 * App-level wrapper around the core useLedgerConnection hook.
 * Resolves all Ledger transport providers from the registry, filters
 * to the ones supported on this platform (BLE on iOS+Android+web via Web
 * Bluetooth, USB on Android+web via WebHID), and passes them to the core
 * hook.
 */
export const useLedgerConnection = (
    options?: UseLedgerConnectionOptions,
): UseLedgerConnectionWrapperResult => {
    const { isReady, supportedProviders, supportedTransportTypes } =
        useSupportedLedgerTransports()

    // Keyed on the joined string so an inline `{ transportTypes: ['usb'] }`
    // literal doesn't bust the memo (and with it the core hook's startScan
    // identity) on every render.
    const transportKey = options?.transportTypes?.join(',')
    const scanProviders = useMemo(() => {
        if (transportKey === undefined) return supportedProviders
        const allowed = new Set(transportKey.split(','))
        return supportedProviders.filter(p => allowed.has(p.transportType))
    }, [supportedProviders, transportKey])

    const core = useLedgerConnectionCore(scanProviders)

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
        supportedTransportTypes,
    }
}
