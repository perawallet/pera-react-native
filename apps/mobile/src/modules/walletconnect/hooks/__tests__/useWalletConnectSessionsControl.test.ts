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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWalletConnectSessionsControl } from '../useWalletConnectSessionsControl'

const mockDisconnect = vi.fn()
const mockDeleteAllSessions = vi.fn()
const mockConnections = [{ clientId: 'client-1' }]

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({
        connections: mockConnections,
        disconnect: mockDisconnect,
        deleteAllSessions: mockDeleteAllSessions,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useWalletConnectSessionsControl (native)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes connections and deleteAllSessions from useWalletConnect(network) straight through unchanged', () => {
        const { result } = renderHook(() => useWalletConnectSessionsControl())

        expect(result.current.connections).toBe(mockConnections)
        expect(result.current.deleteAllSessions).toBe(mockDeleteAllSessions)
    })

    it('disconnect always forwards triggerDisconnect: true — no caller of this hook ever needs false', async () => {
        const { result } = renderHook(() => useWalletConnectSessionsControl())

        await result.current.disconnect('client-1')

        expect(mockDisconnect).toHaveBeenCalledWith('client-1', true)
    })
})
