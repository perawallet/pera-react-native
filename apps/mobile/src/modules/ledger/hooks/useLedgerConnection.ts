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
import { getProvider } from '@perawallet/wallet-extension-provider'
import type {
    HardwareWalletDevice,
    HardwareWalletTransport,
    HardwareWalletTransportProvider,
    HardwareWalletConnectionStatus,
} from '@perawallet/wallet-core-hardware-wallet'
import { LEDGER_SCAN_TIMEOUT_MS } from '@perawallet/wallet-core-ledger'

type UseLedgerConnectionResult = {
    devices: HardwareWalletDevice[]
    isScanning: boolean
    connectionStatus: HardwareWalletConnectionStatus
    startScan: () => void
    stopScan: () => void
    connect: (deviceId: string) => Promise<HardwareWalletTransport>
    disconnect: () => Promise<void>
    error: Error | null
}

/**
 * Hook that manages BLE scanning and connection to Ledger devices.
 * Uses the hardware wallet registry via getProvider().hardwareWalletRegistry.
 */
export const useLedgerConnection = (): UseLedgerConnectionResult => {
    const [devices, setDevices] = useState<HardwareWalletDevice[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [connectionStatus, setConnectionStatus] =
        useState<HardwareWalletConnectionStatus>('disconnected')
    const [error, setError] = useState<Error | null>(null)

    const providerRef = useRef<HardwareWalletTransportProvider | null>(null)
    const stopScanRef = useRef<(() => void) | null>(null)
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const transportRef = useRef<HardwareWalletTransport | null>(null)

    const getOrCreateProvider =
        useCallback((): HardwareWalletTransportProvider => {
            if (!providerRef.current) {
                providerRef.current =
                    getProvider().hardwareWalletRegistry.getProvider('ledger')!
            }
            return providerRef.current
        }, [])

    const stopScan = useCallback(() => {
        stopScanRef.current?.()
        stopScanRef.current = null
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
            scanTimeoutRef.current = null
        }
        setIsScanning(false)
    }, [])

    const startScan = useCallback(() => {
        setDevices([])
        setError(null)
        setIsScanning(true)
        setConnectionStatus('scanning')

        const provider = getOrCreateProvider()
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
    }, [stopScan, getOrCreateProvider])

    const connect = useCallback(
        async (deviceId: string): Promise<HardwareWalletTransport> => {
            stopScan()
            setConnectionStatus('connecting')
            setError(null)

            try {
                const provider = getOrCreateProvider()
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
        [stopScan, getOrCreateProvider],
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
            transportRef.current?.disconnect()
        }
    }, [])

    return {
        devices,
        isScanning,
        connectionStatus,
        startScan,
        stopScan,
        connect,
        disconnect,
        error,
    }
}
