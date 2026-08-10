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
import { useWalletConnectPairing } from '../useWalletConnectPairing'

const mockConnect = vi.fn()
const mockWaitForSessionOutcome = vi.fn()

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: mockConnect }),
    waitForSessionOutcome: (...args: unknown[]) =>
        mockWaitForSessionOutcome(...args),
    // Real value from packages/walletconnect/src/constants.ts.
    WC_SESSION_OUTCOME_TIMEOUT_MS: 8000,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useWalletConnectPairing (native)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('connects with the given uri and waits for the outcome scoped to the new connector', async () => {
        mockConnect.mockResolvedValue('pairing-client')
        mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
        const { result } = renderHook(() => useWalletConnectPairing())

        const outcome = await result.current.pair('wc:123')

        expect(mockConnect).toHaveBeenCalledWith({
            connection: { uri: 'wc:123' },
        })
        expect(mockWaitForSessionOutcome).toHaveBeenCalledWith(
            'pairing-client',
            expect.any(Number),
        )
        expect(outcome).toEqual({ type: 'session' })
    })

    it('reports a connect-failed result when connect() throws, without ever waiting for an outcome', async () => {
        const connectError = new Error('bridge unreachable')
        mockConnect.mockRejectedValue(connectError)
        const { result } = renderHook(() => useWalletConnectPairing())

        const outcome = await result.current.pair('wc:123')

        expect(outcome).toEqual({
            type: 'connect-failed',
            error: connectError,
        })
        expect(mockWaitForSessionOutcome).not.toHaveBeenCalled()
    })

    it('passes through a rejected/errored outcome (e.g. wrong network) unchanged', async () => {
        mockConnect.mockResolvedValue('pairing-client')
        const rejectionError = Object.assign(new Error('wrong network'), {
            clientId: 'pairing-client',
        })
        mockWaitForSessionOutcome.mockResolvedValue({
            type: 'error',
            error: rejectionError,
        })
        const { result } = renderHook(() => useWalletConnectPairing())

        const outcome = await result.current.pair('wc:123')

        expect(outcome).toEqual({ type: 'error', error: rejectionError })
    })

    it('passes through a timeout outcome unchanged', async () => {
        mockConnect.mockResolvedValue('pairing-client')
        mockWaitForSessionOutcome.mockResolvedValue({ type: 'timeout' })
        const { result } = renderHook(() => useWalletConnectPairing())

        const outcome = await result.current.pair('wc:123')

        expect(outcome).toEqual({ type: 'timeout' })
    })
})
