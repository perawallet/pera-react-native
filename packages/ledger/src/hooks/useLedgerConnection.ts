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

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
    HardwareWalletDevice,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
    HardwareWalletConnectionStatus,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    LEDGER_SCAN_TIMEOUT_MS,
    LedgerProviderNotFoundError,
    LedgerScanTimeoutError,
    classifyLedgerError,
} from '@perawallet/wallet-extension-ledger-shared'
import type { AppError, Nullable } from '@perawallet/wallet-core-shared'

export type UseLedgerConnectionResult = {
    devices: HardwareWalletDevice[]
    isScanning: boolean
    connectionStatus: HardwareWalletConnectionStatus
    startScan: () => void
    stopScan: () => void
    connect: (device: HardwareWalletDevice) => Promise<HardwareWalletTransport>
    disconnect: () => Promise<void>
    error: Nullable<AppError>
}

const buildDeviceKey = (device: HardwareWalletDevice): string =>
    `${device.transportType}:${device.id}`

/**
 * Hook that manages scanning and connection to Ledger devices across
 * multiple transport providers (BLE, USB). Devices from each provider
 * are merged into a single device list. `connect()` routes to the
 * provider that originally emitted the device.
 *
 * Callers pass every Ledger transport provider whose `isSupported()`
 * resolves to true (caller filters before passing in — see
 * `apps/mobile/src/modules/ledger/hooks/useLedgerConnectionProvider.ts`).
 */
export const useLedgerConnection = (
    providers: HardwareWalletTransportProvider[],
): UseLedgerConnectionResult => {
    const [devices, setDevices] = useState<HardwareWalletDevice[]>([])
    const [connectionStatus, setConnectionStatus] =
        useState<HardwareWalletConnectionStatus>('disconnected')
    const [error, setError] = useState<Nullable<AppError>>(null)

    const stopScansRef = useRef<Array<() => void>>([])
    const scanTimeoutRef = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const transportRef = useRef<Nullable<HardwareWalletTransport>>(null)
    const deviceProviderRef = useRef<
        Map<string, HardwareWalletTransportProvider>
    >(new Map())

    const stopScan = useCallback(() => {
        for (const stop of stopScansRef.current) stop()
        stopScansRef.current = []
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
            scanTimeoutRef.current = null
        }
        setConnectionStatus('disconnected')
    }, [])

    const startScan = useCallback(() => {
        // Re-entrant: tear down any active scan (subscriptions + timer)
        // before starting a fresh one — otherwise Retry leaks the previous
        // subscriptions and inherits a timer that kills the new scan early.
        stopScan()

        setDevices([])
        setError(null)
        setConnectionStatus('scanning')
        deviceProviderRef.current = new Map()

        const seen = new Set<string>()

        stopScansRef.current = providers.map(provider =>
            provider.scan(
                (device: HardwareWalletDevice) => {
                    const key = buildDeviceKey(device)
                    if (seen.has(key)) return
                    seen.add(key)
                    deviceProviderRef.current.set(key, provider)
                    setDevices(prev => [...prev, device])
                },
                (err: Error) => {
                    setError(classifyLedgerError(err))
                    stopScan()
                },
            ),
        )

        scanTimeoutRef.current = setTimeout(() => {
            // An empty scan hitting the budget is a failure the user must be
            // able to see and retry — never a silent stop that leaves the
            // screen faking "searching". A populated list is a successful
            // scan; stopping it quietly is correct.
            if (seen.size === 0) {
                setError(
                    new LedgerScanTimeoutError(
                        `no device found within ${LEDGER_SCAN_TIMEOUT_MS}ms`,
                    ),
                )
            }
            stopScan()
        }, LEDGER_SCAN_TIMEOUT_MS)
    }, [stopScan, providers])

    const connect = useCallback(
        async (
            device: HardwareWalletDevice,
        ): Promise<HardwareWalletTransport> => {
            stopScan()
            setConnectionStatus('connecting')
            setError(null)

            const key = buildDeviceKey(device)
            const provider = deviceProviderRef.current.get(key)
            if (!provider) {
                const e = new LedgerProviderNotFoundError(
                    `No provider tracked for device "${key}"`,
                )
                setError(e)
                setConnectionStatus('disconnected')
                throw e
            }

            try {
                const transport = await provider.connect(device.id)
                transportRef.current = transport
                setConnectionStatus('connected')
                return transport
            } catch (err) {
                const connectError = classifyLedgerError(err)
                setError(connectError)
                setConnectionStatus('disconnected')
                throw connectError
            }
        },
        [stopScan],
    )

    const disconnect = useCallback(async () => {
        await transportRef.current?.disconnect()
        transportRef.current = null
        setConnectionStatus('disconnected')
    }, [])

    useEffect(() => {
        return () => {
            for (const stop of stopScansRef.current) stop()
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
            try {
                const result = transportRef.current?.disconnect()
                if (result && typeof result.catch === 'function') {
                    result.catch(() => {})
                }
            } catch {
                // ignore — disconnect should not throw during cleanup
            }
        }
    }, [])

    return {
        devices,
        isScanning: connectionStatus === 'scanning',
        connectionStatus,
        startScan,
        stopScan,
        connect,
        disconnect,
        error,
    }
}
