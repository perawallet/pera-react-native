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

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
    HardwareWalletDevice,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
    HardwareWalletConnectionStatus,
} from '@perawallet/wallet-core-hardware-wallet'
import { LEDGER_SCAN_TIMEOUT_MS } from '@perawallet/wallet-extension-ledger-react-native/protocol'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseLedgerConnectionResult = {
    devices: HardwareWalletDevice[]
    isScanning: boolean
    connectionStatus: HardwareWalletConnectionStatus
    startScan: () => void
    stopScan: () => void
    connect: (deviceId: string) => Promise<HardwareWalletTransport>
    disconnect: () => Promise<void>
    error: Nullable<Error>
}

/**
 * Hook that manages BLE scanning and connection to Ledger devices.
 *
 * @param provider - The hardware wallet transport provider for Ledger devices.
 *   Callers obtain this from the hardware wallet registry, e.g.
 *   `getProvider().hardwareWalletRegistry.getProvider('ledger')`.
 */
export const useLedgerConnection = (
    provider: HardwareWalletTransportProvider,
): UseLedgerConnectionResult => {
    const [devices, setDevices] = useState<HardwareWalletDevice[]>([])
    const [connectionStatus, setConnectionStatus] =
        useState<HardwareWalletConnectionStatus>('disconnected')
    const [error, setError] = useState<Nullable<Error>>(null)

    const stopScanRef = useRef<Nullable<() => void>>(null)
    const scanTimeoutRef = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const transportRef = useRef<Nullable<HardwareWalletTransport>>(null)

    const stopScan = useCallback(() => {
        stopScanRef.current?.()
        stopScanRef.current = null
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
            scanTimeoutRef.current = null
        }
        setConnectionStatus('disconnected')
    }, [])

    const startScan = useCallback(() => {
        setDevices([])
        setError(null)
        setConnectionStatus('scanning')

        const seenIds = new Set<string>()

        const stop = provider.scan(
            (device: HardwareWalletDevice) => {
                if (seenIds.has(device.id)) return
                seenIds.add(device.id)
                setDevices(prev => [...prev, device])
            },
            (err: Error) => {
                setError(err)
                stopScan()
            },
        )

        stopScanRef.current = stop

        scanTimeoutRef.current = setTimeout(() => {
            stopScan()
        }, LEDGER_SCAN_TIMEOUT_MS)
    }, [stopScan, provider])

    const connect = useCallback(
        async (deviceId: string): Promise<HardwareWalletTransport> => {
            stopScan()
            setConnectionStatus('connecting')
            setError(null)

            try {
                const transport = await provider.connect(deviceId)
                transportRef.current = transport
                setConnectionStatus('connected')
                return transport
            } catch (err) {
                const connectError =
                    err instanceof Error ? err : new Error(String(err))
                setError(connectError)
                setConnectionStatus('disconnected')
                throw connectError
            }
        },
        [stopScan, provider],
    )

    const disconnect = useCallback(async () => {
        await transportRef.current?.disconnect()
        transportRef.current = null
        setConnectionStatus('disconnected')
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopScanRef.current?.()
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current)
            }
            transportRef.current?.disconnect().catch(() => {})
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
