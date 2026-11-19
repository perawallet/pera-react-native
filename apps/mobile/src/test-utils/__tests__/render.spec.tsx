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

import { describe, expect, it } from 'vitest'
import { fireEvent, renderHook, screen } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'

import {
    createQueryClientWrapper,
    createTestQueryClient,
    render,
} from '../render'

describe('render', () => {
    it('keeps cached data when the rendered UI is rerendered', () => {
        const key = ['render-test']
        const CachedValue = () => {
            const client = useQueryClient()
            return (
                <>
                    <button
                        onClick={() => client.setQueryData(key, 'cached value')}
                    >
                        Seed cache
                    </button>
                    <span>{client.getQueryData<string>(key) ?? 'empty'}</span>
                </>
            )
        }

        const { rerender } = render(<CachedValue />)
        fireEvent.click(screen.getByRole('button', { name: 'Seed cache' }))

        rerender(<CachedValue />)

        expect(screen.queryByText('cached value')).not.toBeNull()
    })
})

describe('createQueryClientWrapper', () => {
    it('provides the given client and keeps it across rerenders', () => {
        const client = createTestQueryClient()

        const { result, rerender } = renderHook(() => useQueryClient(), {
            wrapper: createQueryClientWrapper(client),
        })
        rerender()

        expect(result.current).toBe(client)
    })

    it('defaults to a test client that does not retry', () => {
        const { result } = renderHook(() => useQueryClient(), {
            wrapper: createQueryClientWrapper(),
        })

        expect(result.current.getDefaultOptions().queries?.retry).toBe(false)
    })
})
