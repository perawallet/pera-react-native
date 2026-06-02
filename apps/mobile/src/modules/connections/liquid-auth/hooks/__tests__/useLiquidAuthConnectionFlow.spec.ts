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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLiquidAuthStore } from '@perawallet/wallet-core-liquid-auth'

const connect = vi.fn()
const disconnect = vi.fn()
vi.mock('../useLiquidAuthConnect', () => ({
    useLiquidAuthConnect: () => ({ connect, disconnect }),
}))

import { useLiquidAuthConnectionFlow } from '../useLiquidAuthConnectionFlow'

const REQUEST = { host: 'https://relay.example', requestId: 'req-1' }

describe('useLiquidAuthConnectionFlow', () => {
    beforeEach(() => vi.clearAllMocks())

    it('starts at select-account for an active request', () => {
        const { result } = renderHook(() =>
            useLiquidAuthConnectionFlow(REQUEST),
        )
        expect(result.current.phase).toBe('select-account')
    })

    it('moves to connecting on account select and to confirm when identity arrives', async () => {
        connect.mockImplementation(async ({ requestConfirmation }) => {
            await Promise.resolve()
            await requestConfirmation({
                name: 'Tinyman',
                origin: 'https://app.tinyman.org',
                verified: false,
            })
            await new Promise<void>(() => {}) // stay pending after confirm
        })
        const { result } = renderHook(() =>
            useLiquidAuthConnectionFlow(REQUEST),
        )
        act(() => result.current.onSelectAccount('ADDR1'))
        expect(result.current.phase).toBe('connecting')
        await waitFor(() => expect(result.current.phase).toBe('confirm'))
        expect(result.current.identity).toEqual({
            name: 'Tinyman',
            origin: 'https://app.tinyman.org',
            verified: false,
        })
        expect(result.current.selectedAddress).toBe('ADDR1')
    })

    it('onConfirm resolves the confirmation so connect can proceed', async () => {
        let confirmResolved = false
        connect.mockImplementation(async ({ requestConfirmation }) => {
            await Promise.resolve()
            confirmResolved = await requestConfirmation({
                name: 'x',
                origin: 'x',
                verified: false,
            })
        })
        const { result } = renderHook(() =>
            useLiquidAuthConnectionFlow(REQUEST),
        )
        act(() => result.current.onSelectAccount('ADDR1'))
        await waitFor(() => expect(result.current.phase).toBe('confirm'))
        await act(async () => result.current.onConfirm())
        expect(confirmResolved).toBe(true)
    })

    it('enters finalizing on confirm and ignores a late cancel/reject', async () => {
        const setConnectRequest = vi.spyOn(
            useLiquidAuthStore.getState(),
            'setConnectRequest',
        )
        connect.mockImplementation(async ({ requestConfirmation }) => {
            await Promise.resolve()
            await requestConfirmation({
                name: 'x',
                origin: 'x',
                verified: false,
            })
            await new Promise<void>(() => {}) // stay pending after confirm
        })
        const { result } = renderHook(() =>
            useLiquidAuthConnectionFlow(REQUEST),
        )
        act(() => result.current.onSelectAccount('ADDR1'))
        await waitFor(() => expect(result.current.phase).toBe('confirm'))

        act(() => result.current.onConfirm())
        expect(result.current.phase).toBe('finalizing')

        // A late cancel/reject while persisting must be inert (no clearRequest),
        // so the succeeding connection isn't torn down mid-flight.
        setConnectRequest.mockClear()
        act(() => result.current.onCancel())
        act(() => result.current.onReject())
        expect(setConnectRequest).not.toHaveBeenCalled()
        setConnectRequest.mockRestore()
    })

    it('onReject resolves the confirmation with false', async () => {
        let confirmResult: boolean | undefined
        connect.mockImplementation(async ({ requestConfirmation }) => {
            await Promise.resolve()
            confirmResult = await requestConfirmation({
                name: 'x',
                origin: 'x',
                verified: false,
            })
        })
        const { result } = renderHook(() =>
            useLiquidAuthConnectionFlow(REQUEST),
        )
        act(() => result.current.onSelectAccount('ADDR1'))
        await waitFor(() => expect(result.current.phase).toBe('confirm'))
        await act(async () => result.current.onReject())
        expect(confirmResult).toBe(false)
    })

    it('resets to select-account when requestId changes', async () => {
        connect.mockImplementation(async ({ requestConfirmation }) => {
            await Promise.resolve()
            await requestConfirmation({
                name: 'x',
                origin: 'x',
                verified: false,
            })
            await new Promise<void>(() => {}) // stay pending
        })
        const REQUEST_2 = { host: 'https://relay.example', requestId: 'req-2' }
        const { result, rerender } = renderHook(
            ({ req }) => useLiquidAuthConnectionFlow(req),
            { initialProps: { req: REQUEST } },
        )
        act(() => result.current.onSelectAccount('ADDR1'))
        await waitFor(() => expect(result.current.phase).toBe('confirm'))
        rerender({ req: REQUEST_2 })
        await waitFor(() => expect(result.current.phase).toBe('select-account'))
    })

    it('onCancel rejects the confirmation and clears the request', async () => {
        const setConnectRequest = vi.spyOn(
            useLiquidAuthStore.getState(),
            'setConnectRequest',
        )
        let confirmResult: boolean | undefined
        connect.mockImplementation(async ({ requestConfirmation }) => {
            await Promise.resolve()
            confirmResult = await requestConfirmation({
                name: 'x',
                origin: 'x',
                verified: false,
            })
        })
        const { result } = renderHook(() =>
            useLiquidAuthConnectionFlow(REQUEST),
        )
        act(() => result.current.onSelectAccount('ADDR1'))
        await waitFor(() => expect(result.current.phase).toBe('confirm'))
        await act(async () => result.current.onCancel())
        expect(confirmResult).toBe(false)
        expect(setConnectRequest).toHaveBeenCalledWith(null)
        setConnectRequest.mockRestore()
    })
})
