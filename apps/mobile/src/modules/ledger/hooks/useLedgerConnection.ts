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
    LedgerDevice,
    LedgerTransport,
    LedgerTransportProvider,
    LedgerConnectionStatus,
} from '@perawallet/wallet-core-ledger'
import { LEDGER_SCAN_TIMEOUT_MS } from '@perawallet/wallet-core-ledger'

type UseLedgerConnectionResult = {
    devices: LedgerDevice[]
    isScanning: boolean
    connectionStatus: LedgerConnectionStatus
    startScan: () => void
    stopScan: () => void
    connect: (deviceId: string) => Promise<LedgerTransport>
    disconnect: () => Promise<void>
    error: Error | null
}

/**
 * Hook that manages BLE scanning and connection to Ledger devices.
 * Uses the platform LedgerService via getProvider().ledger.
 */
export const useLedgerConnection = (): UseLedgerConnectionResult => {
    const [devices, setDevices] = useState<LedgerDevice[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [connectionStatus, setConnectionStatus] =
        useState<LedgerConnectionStatus>('disconnected')
    const [error, setError] = useState<Error | null>(null)

    const providerRef = useRef<LedgerTransportProvider | null>(null)
    const stopScanRef = useRef<(() => void) | null>(null)
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const transportRef = useRef<LedgerTransport | null>(null)

    const getOrCreateProvider = useCallback((): LedgerTransportProvider => {
        if (!providerRef.current) {
            providerRef.current = getProvider().ledger.createTransportProvider()
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
            (device: LedgerDevice) => {
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
        async (deviceId: string): Promise<LedgerTransport> => {
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
