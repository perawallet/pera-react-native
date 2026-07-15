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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const discoverLedgerAccountsMock = vi.hoisted(() => vi.fn())

vi.mock('../../discovery', () => ({
    discoverLedgerAccounts: discoverLedgerAccountsMock,
}))

import { useLedgerAccounts } from '../useLedgerAccounts'
import type { LedgerTransport } from '@perawallet/wallet-extension-ledger-react-native/protocol'
import type { Nullable } from '@perawallet/wallet-core-shared'

const makeTransport = () =>
    ({ mock: 'transport' }) as unknown as LedgerTransport

describe('useLedgerAccounts', () => {
    beforeEach(() => {
        discoverLedgerAccountsMock.mockReset()
    })

    test('discover sets accounts and clears loading state on success', async () => {
        const accounts = [{ address: 'A', index: 0 }]
        discoverLedgerAccountsMock.mockResolvedValue(accounts)

        const { result } = renderHook(() => useLedgerAccounts())

        await act(async () => {
            await result.current.discover(makeTransport())
        })

        expect(result.current.accounts).toEqual(accounts)
        expect(result.current.isDiscovering).toBe(false)
        expect(result.current.error).toBeNull()
    })

    test('discover surfaces onProgress updates to the current counter', async () => {
        discoverLedgerAccountsMock.mockImplementation(
            async ({ onProgress }: { onProgress: (i: number) => void }) => {
                onProgress(0)
                onProgress(2)
                return []
            },
        )

        const { result } = renderHook(() => useLedgerAccounts())

        await act(async () => {
            await result.current.discover(makeTransport())
        })

        // current reflects (last reported index) + 1
        expect(result.current.progress.current).toBe(3)
    })

    test('discover rethrows and sets error when discovery fails', async () => {
        discoverLedgerAccountsMock.mockRejectedValue(new Error('device locked'))

        const { result } = renderHook(() => useLedgerAccounts())

        let caught: Nullable<Error> = null
        await act(async () => {
            try {
                await result.current.discover(makeTransport())
            } catch (err) {
                caught = err as Error
            }
        })

        expect(caught?.message).toMatch(/device locked/)
        expect(result.current.error?.message).toMatch(/device locked/)
        expect(result.current.isDiscovering).toBe(false)
    })

    test('retry re-runs the last transport', async () => {
        discoverLedgerAccountsMock.mockResolvedValue([])

        const { result } = renderHook(() => useLedgerAccounts())
        const transport = makeTransport()

        await act(async () => {
            await result.current.discover(transport)
        })
        discoverLedgerAccountsMock.mockClear()

        act(() => {
            result.current.retry()
        })

        await waitFor(() =>
            expect(discoverLedgerAccountsMock).toHaveBeenCalledWith(
                expect.objectContaining({ transport }),
            ),
        )
    })

    test('retry is a no-op when no transport has been used', () => {
        const { result } = renderHook(() => useLedgerAccounts())
        act(() => {
            result.current.retry()
        })
        expect(discoverLedgerAccountsMock).not.toHaveBeenCalled()
    })
})
