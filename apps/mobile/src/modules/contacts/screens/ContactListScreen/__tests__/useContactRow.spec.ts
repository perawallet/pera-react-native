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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContactRow } from '../useContactRow'

vi.mock('@hooks/useLanguage')

vi.mock('@modules/chain-ui', () => ({
    chainFamilyDisplay: (family: string) => ({
        truncate: (address: string) => `${family}:${address.slice(0, 4)}`,
    }),
}))

describe('useContactRow', () => {
    it('shows a single address truncated by its family', () => {
        const { result } = renderHook(() =>
            useContactRow({
                id: 'id-1',
                name: 'Alice',
                addresses: { evm: '0xA11CE' },
            }),
        )

        expect(result.current).toEqual({
            primaryAddress: '0xA11CE',
            subtitle: 'evm:0xA1',
        })
    })

    it('counts the networks of a contact with several addresses, named by the first', () => {
        const { result } = renderHook(() =>
            useContactRow({
                id: 'id-1',
                name: 'Alice',
                addresses: { evm: '0xA11CE', algorand: 'ALGO' },
            }),
        )

        expect(result.current).toEqual({
            primaryAddress: 'ALGO',
            subtitle: 'contacts.list.networks_count',
        })
    })
})
