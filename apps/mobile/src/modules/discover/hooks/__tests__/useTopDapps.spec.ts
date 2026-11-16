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

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useDiscoverProjectsQuery,
    type PeraProject,
} from '@perawallet/wallet-core-projects'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useTopDapps } from '../useTopDapps'

const refetch = vi.fn()

const mockQuery = (data: PeraProject[] | undefined) =>
    vi.mocked(useDiscoverProjectsQuery).mockReturnValue({
        data,
        isLoading: false,
        isError: false,
        refetch,
    } as never)

const listed = (n: number): PeraProject => ({
    chains: ['eip155:1'],
    url: `https://app${n}.io`,
    name: `App ${n}`,
})

describe('useTopDapps', () => {
    beforeEach(() => {
        registerEthereumChain()
        vi.mocked(useDiscoverProjectsQuery).mockReset()
    })
    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('queries the chain CAIP-2', () => {
        mockQuery([])
        renderHook(() => useTopDapps('ethereum'))
        expect(useDiscoverProjectsQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ chains: ['eip155:1'], isEnabled: true }),
        )
    })

    it('skips an invalid project before slicing to four', () => {
        mockQuery([
            { chains: [], name: 'No url' },
            ...[1, 2, 3, 4, 5].map(listed),
        ])
        const { result } = renderHook(() => useTopDapps('ethereum'))
        expect(result.current.dapps.map(d => d.name)).toEqual([
            'App 1',
            'App 2',
            'App 3',
            'App 4',
        ])
    })

    it('drops a duplicate url before slicing to four', () => {
        mockQuery([
            listed(1),
            { ...listed(1), name: 'App 1 again', url: 'https://APP1.io/' },
            ...[2, 3, 4, 5].map(listed),
        ])
        const { result } = renderHook(() => useTopDapps('ethereum'))
        expect(result.current.dapps.map(d => d.name)).toEqual([
            'App 1',
            'App 2',
            'App 3',
            'App 4',
        ])
    })

    it('exposes the verified urls', () => {
        mockQuery([
            {
                ...listed(1),
                url: 'https://A.io/',
                verificationTier: 'verified',
            },
            listed(2),
        ])
        const { result } = renderHook(() => useTopDapps('ethereum'))
        expect(result.current.verifiedUrls).toEqual(new Set(['https://a.io']))
    })

    it('is disabled with no chain', () => {
        mockQuery(undefined)
        const { result } = renderHook(() => useTopDapps(null))
        expect(useDiscoverProjectsQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ chains: [], isEnabled: false }),
        )
        expect(result.current.dapps).toEqual([])
    })

    it('refetch returns the query promise', async () => {
        const promise = Promise.resolve('done')
        refetch.mockReturnValue(promise)
        mockQuery([])
        const { result } = renderHook(() => useTopDapps('ethereum'))
        expect(result.current.refetch()).toBe(promise)
    })
})
