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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAssetAuthoritiesQuery } from '../useAssetAuthoritiesQuery'
import { registerFakeAssetsAdapter } from '../../__tests__/fakeAssetsChain'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

describe('useAssetAuthoritiesQuery', () => {
    it('maps the adapter result and passes the active scope', async () => {
        const fetchAssetAuthorities = vi.fn().mockResolvedValue({
            hasFreeze: true,
            hasClawback: false,
            freezeAddress: 'FREEZEADDR',
            clawbackAddress: null,
        })
        registerFakeAssetsAdapter({ fetchAssetAuthorities })

        const { result } = renderHook(() => useAssetAuthoritiesQuery('123'), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.hasFreeze).toBe(true)
        expect(result.current.hasClawback).toBe(false)
        expect(result.current.freezeAddress).toBe('FREEZEADDR')
        expect(result.current.clawbackAddress).toBeNull()
        expect(fetchAssetAuthorities).toHaveBeenCalledWith('123', {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
    })

    it('does not query for the native asset', () => {
        const fetchAssetAuthorities = vi.fn()
        registerFakeAssetsAdapter({ fetchAssetAuthorities })

        const { result } = renderHook(() => useAssetAuthoritiesQuery('0'), {
            wrapper,
        })

        expect(fetchAssetAuthorities).not.toHaveBeenCalled()
        expect(result.current.hasFreeze).toBe(false)
        expect(result.current.hasClawback).toBe(false)
    })

    it('surfaces an adapter failure as an error, not a cleared authority', async () => {
        registerFakeAssetsAdapter({
            fetchAssetAuthorities: vi.fn().mockRejectedValue(new Error('down')),
        })

        const { result } = renderHook(() => useAssetAuthoritiesQuery('123'), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.hasFreeze).toBe(false)
    })
})
