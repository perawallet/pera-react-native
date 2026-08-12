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
import {
    resetPairingStateForTesting,
    useWalletConnectPairing,
} from '../useWalletConnectPairing'
import { useReturnToDappStore } from '../../stores/useReturnToDappStore'

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
        resetPairingStateForTesting()
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

    it('uses the default 8s outcome budget when no override is given', async () => {
        mockConnect.mockResolvedValue('pairing-client')
        mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
        const { result } = renderHook(() => useWalletConnectPairing())

        await result.current.pair('wc:123')

        expect(mockWaitForSessionOutcome).toHaveBeenCalledWith(
            'pairing-client',
            8000,
        )
    })

    it('honors an outcome-budget override (deep-link pairings get 15s)', async () => {
        mockConnect.mockResolvedValue('pairing-client')
        mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
        const { result } = renderHook(() => useWalletConnectPairing())

        await result.current.pair('wc:123', { outcomeTimeoutMs: 15_000 })

        expect(mockWaitForSessionOutcome).toHaveBeenCalledWith(
            'pairing-client',
            15_000,
        )
    })

    it('stamps the connector id onto a timeout outcome so callers can watch or abandon it', async () => {
        mockConnect.mockResolvedValue('pairing-client')
        mockWaitForSessionOutcome.mockResolvedValue({ type: 'timeout' })
        const { result } = renderHook(() => useWalletConnectPairing())

        const outcome = await result.current.pair('wc:123')

        expect(outcome).toEqual({
            type: 'timeout',
            clientId: 'pairing-client',
        })
    })

    describe('handshake-topic dedupe', () => {
        const uriForTopic = (topic: string) =>
            `wc:${topic}@1?bridge=https://bridge.example&key=ff`

        it('joins concurrent pair() calls for the same handshake topic onto one connector', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            let settleOutcome: (value: unknown) => void = () => {}
            mockWaitForSessionOutcome.mockReturnValue(
                new Promise(resolve => {
                    settleOutcome = resolve
                }),
            )
            const { result } = renderHook(() => useWalletConnectPairing())

            const first = result.current.pair(uriForTopic('topic-a'))
            const second = result.current.pair(uriForTopic('topic-a'))
            settleOutcome({ type: 'session' })

            const outcomes = await Promise.all([first, second])
            expect(mockConnect).toHaveBeenCalledTimes(1)
            expect(outcomes[0]).toEqual({ type: 'session' })
            expect(outcomes[1]).toBe(outcomes[0])
        })

        it('runs concurrent pairings for different topics independently', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
            const { result } = renderHook(() => useWalletConnectPairing())

            await Promise.all([
                result.current.pair(uriForTopic('topic-a')),
                result.current.pair(uriForTopic('topic-b')),
            ])

            expect(mockConnect).toHaveBeenCalledTimes(2)
        })

        it('allows a deliberate retry once the first attempt settled', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            mockWaitForSessionOutcome.mockResolvedValue({ type: 'timeout' })
            const { result } = renderHook(() => useWalletConnectPairing())

            await result.current.pair(uriForTopic('topic-a'))
            await result.current.pair(uriForTopic('topic-a'))

            expect(mockConnect).toHaveBeenCalledTimes(2)
        })

        it('does not dedupe URIs without a parseable topic', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            let settleOutcome: (value: unknown) => void = () => {}
            mockWaitForSessionOutcome.mockReturnValue(
                new Promise(resolve => {
                    settleOutcome = resolve
                }),
            )
            const { result } = renderHook(() => useWalletConnectPairing())

            const first = result.current.pair('not-a-wc-uri')
            const second = result.current.pair('not-a-wc-uri')
            settleOutcome({ type: 'session' })
            await Promise.all([first, second])

            expect(mockConnect).toHaveBeenCalledTimes(2)
        })
    })

    describe('return-to-dapp context', () => {
        const getContext = (clientId: string) =>
            useReturnToDappStore.getState().returnContexts[clientId]

        beforeEach(() => {
            useReturnToDappStore.getState().resetState()
        })

        it('records the context for the new connector when the session arrives', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
            const { result } = renderHook(() => useWalletConnectPairing())

            await result.current.pair('wc:123', {
                origin: { source: 'external-browser', browserName: 'chrome' },
            })

            expect(getContext('pairing-client')).toMatchObject({
                browserName: 'chrome',
            })
        })

        it('clears the context when the handshake errors', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            mockWaitForSessionOutcome.mockResolvedValue({
                type: 'error',
                error: new Error('wrong network'),
            })
            const { result } = renderHook(() => useWalletConnectPairing())

            await result.current.pair('wc:123', {
                origin: { source: 'external-browser' },
            })

            expect(getContext('pairing-client')).toBeUndefined()
        })

        it('keeps the context on a timeout so a late session can still offer the CTA', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            mockWaitForSessionOutcome.mockResolvedValue({ type: 'timeout' })
            const { result } = renderHook(() => useWalletConnectPairing())

            await result.current.pair('wc:123', {
                origin: { source: 'external-browser' },
            })

            expect(getContext('pairing-client')).toBeDefined()
        })

        it('does not touch the store when no return context is requested', async () => {
            mockConnect.mockResolvedValue('pairing-client')
            mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
            const { result } = renderHook(() => useWalletConnectPairing())

            await result.current.pair('wc:123')

            expect(useReturnToDappStore.getState().returnContexts).toEqual({})
        })
    })
})
