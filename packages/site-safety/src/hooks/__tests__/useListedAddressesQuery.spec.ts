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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { findPhishingListedAddresses } from '../../listedAddresses'
import { usePhishingListStore } from '../../store/store'
import { useListedAddressesQuery } from '../useListedAddressesQuery'

vi.mock('../../listedAddresses', () => ({
    findPhishingListedAddresses: vi.fn(),
}))

const SCAM = '0x09750ad360fdb7A2ee23669C4503c974D86D8694'
const CLEAN = '0x00000000000000000000000000000000000000bb'

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useListedAddressesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        usePhishingListStore.getState().resetState()
        vi.mocked(findPhishingListedAddresses).mockResolvedValue([
            SCAM.toLowerCase(),
        ])
    })

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('reports checking, then which addresses are listed', async () => {
        const { result } = renderHook(
            () => useListedAddressesQuery({ addresses: [SCAM, CLEAN] }),
            { wrapper: createWrapper() },
        )

        expect(result.current.isChecking).toBe(true)
        await waitFor(() => expect(result.current.isChecking).toBe(false))
        expect(result.current.isListed(SCAM)).toBe(true)
        expect(result.current.isListed(SCAM.toLowerCase())).toBe(true)
        expect(result.current.isListed(CLEAN)).toBe(false)
        expect(findPhishingListedAddresses).toHaveBeenCalledWith([
            '0x00000000000000000000000000000000000000bb',
            SCAM.toLowerCase(),
        ])
    })

    it('keeps its answer while a new copy of the lists re-checks the same addresses', async () => {
        const { result } = renderHook(
            () => useListedAddressesQuery({ addresses: [SCAM] }),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isListed(SCAM)).toBe(true))
        vi.mocked(findPhishingListedAddresses).mockReturnValue(
            new Promise(() => {}),
        )

        act(() => {
            usePhishingListStore.getState().activateGeneration('mew-darklist', {
                generation: 2,
                refreshedAt: 1,
                origin: 'downloaded',
            })
        })

        await waitFor(() =>
            expect(findPhishingListedAddresses).toHaveBeenCalledTimes(2),
        )
        expect(result.current.isChecking).toBe(false)
        expect(result.current.isListed(SCAM)).toBe(true)
    })

    it('never lends one set of addresses the answer for another', async () => {
        const { result, rerender } = renderHook(
            ({ addresses }) => useListedAddressesQuery({ addresses }),
            {
                wrapper: createWrapper(),
                initialProps: { addresses: [SCAM] },
            },
        )
        await waitFor(() => expect(result.current.isChecking).toBe(false))
        vi.mocked(findPhishingListedAddresses).mockReturnValue(
            new Promise(() => {}),
        )

        rerender({ addresses: [CLEAN] })

        expect(result.current.isChecking).toBe(true)
        expect(result.current.isListed(SCAM)).toBe(false)
    })

    it('answers while the device is offline', async () => {
        onlineManager.setOnline(false)

        const { result } = renderHook(
            () => useListedAddressesQuery({ addresses: [SCAM] }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isListed(SCAM)).toBe(true))
        expect(result.current.isChecking).toBe(false)
    })

    it('checks nothing when disabled or given no addresses', () => {
        const { result: disabled } = renderHook(
            () =>
                useListedAddressesQuery({
                    addresses: [SCAM],
                    isEnabled: false,
                }),
            { wrapper: createWrapper() },
        )
        const { result: empty } = renderHook(
            () => useListedAddressesQuery({ addresses: [] }),
            { wrapper: createWrapper() },
        )

        expect(disabled.current.isChecking).toBe(false)
        expect(empty.current.isChecking).toBe(false)
        expect(findPhishingListedAddresses).not.toHaveBeenCalled()
    })
})
