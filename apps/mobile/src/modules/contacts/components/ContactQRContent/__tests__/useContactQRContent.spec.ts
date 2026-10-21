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
import { act, renderHook } from '@testing-library/react'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useContactQRContent } from '../useContactQRContent'

const mocks = vi.hoisted(() => ({ copyToClipboard: vi.fn() }))

vi.mock('@hooks/useLanguage')

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mocks.copyToClipboard }),
}))

vi.mock('@utils/shareText', () => ({ shareText: vi.fn() }))

vi.mock('@modules/chain-ui', () => ({
    chainFamilyDisplay: (family: string) => ({
        label: `label:${family}`,
        truncate: (address: string) => `short:${address}`,
    }),
}))

const BOTH: Contact = {
    id: 'id-1',
    name: 'Alice',
    addresses: { algorand: 'ALGO', evm: '0xA11CE' },
}

describe('useContactQRContent', () => {
    it('shows a single address with no family to switch to', () => {
        const { result } = renderHook(() =>
            useContactQRContent({ ...BOTH, addresses: { algorand: 'ALGO' } }),
        )

        expect(result.current.familyOptions).toEqual([])
        expect(result.current.address).toBe('ALGO')
    })

    it('opens on the first address and offers a chip per family', () => {
        const { result } = renderHook(() => useContactQRContent(BOTH))

        expect(result.current.selectedFamily).toBe('algorand')
        expect(result.current.familyOptions).toEqual([
            { family: 'algorand', label: 'label:algorand' },
            { family: 'evm', label: 'label:evm' },
        ])
    })

    it('opens on the family it is given and switches on a chip', () => {
        const { result } = renderHook(() => useContactQRContent(BOTH, 'evm'))

        expect(result.current.address).toBe('0xA11CE')
        expect(result.current.shortAddress).toBe('short:0xA11CE')

        act(() => result.current.selectFamily('algorand'))
        act(() => result.current.handleCopy())

        expect(result.current.address).toBe('ALGO')
        expect(mocks.copyToClipboard).toHaveBeenCalledWith('ALGO')
    })
})
