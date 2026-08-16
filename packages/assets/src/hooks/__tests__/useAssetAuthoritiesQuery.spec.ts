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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAssetAuthoritiesQuery } from '../useAssetAuthoritiesQuery'
import * as api from '../../api'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

const makeIndexerResponse = (params: {
    freeze?: string
    clawback?: string
}): Awaited<ReturnType<typeof api.fetchIndexerAssetDetails>> => ({
    asset: {
        index: '123',
        params: {
            creator: 'CREATOR',
            decimals: 6,
            total: '1000',
            ...params,
        },
    },
    'current-round': 1,
})

describe('useAssetAuthoritiesQuery', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('reports hasFreeze/hasClawback true when both authority addresses are present', async () => {
        vi.spyOn(api, 'fetchIndexerAssetDetails').mockResolvedValue(
            makeIndexerResponse({ freeze: 'FREEZEADDR', clawback: 'CLAWADDR' }),
        )

        const { result } = renderHook(() => useAssetAuthoritiesQuery('123'), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.hasFreeze).toBe(true)
        expect(result.current.hasClawback).toBe(true)
        expect(result.current.freezeAddress).toBe('FREEZEADDR')
        expect(result.current.clawbackAddress).toBe('CLAWADDR')
    })

    it('reports both false when the authority addresses are absent', async () => {
        vi.spyOn(api, 'fetchIndexerAssetDetails').mockResolvedValue(
            makeIndexerResponse({}),
        )

        const { result } = renderHook(() => useAssetAuthoritiesQuery('123'), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.hasFreeze).toBe(false)
        expect(result.current.hasClawback).toBe(false)
        expect(result.current.freezeAddress).toBeNull()
        expect(result.current.clawbackAddress).toBeNull()
    })

    it('does not query for ALGO (assetId 0)', () => {
        const spy = vi.spyOn(api, 'fetchIndexerAssetDetails')

        const { result } = renderHook(() => useAssetAuthoritiesQuery('0'), {
            wrapper,
        })

        expect(spy).not.toHaveBeenCalled()
        expect(result.current.hasFreeze).toBe(false)
        expect(result.current.hasClawback).toBe(false)
    })

    it('treats the all-zero address as a cleared authority', async () => {
        const ZERO_ADDRESS =
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
        vi.spyOn(api, 'fetchIndexerAssetDetails').mockResolvedValue(
            makeIndexerResponse({
                freeze: ZERO_ADDRESS,
                clawback: ZERO_ADDRESS,
            }),
        )

        const { result } = renderHook(() => useAssetAuthoritiesQuery('123'), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.hasFreeze).toBe(false)
        expect(result.current.hasClawback).toBe(false)
        expect(result.current.freezeAddress).toBeNull()
        expect(result.current.clawbackAddress).toBeNull()
    })

    it('still reports a normal address as an active authority', async () => {
        vi.spyOn(api, 'fetchIndexerAssetDetails').mockResolvedValue(
            makeIndexerResponse({ freeze: 'FREEZEADDR' }),
        )

        const { result } = renderHook(() => useAssetAuthoritiesQuery('123'), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.hasFreeze).toBe(true)
        expect(result.current.freezeAddress).toBe('FREEZEADDR')
    })
})
