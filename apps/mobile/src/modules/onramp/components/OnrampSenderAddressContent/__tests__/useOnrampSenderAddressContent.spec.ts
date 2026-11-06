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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { makeDepositToken } from '@test-utils/rampFixtures'
import { useOnrampSenderAddressContent } from '../useOnrampSenderAddressContent'

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mocks.resolve }),
}))

const SOLANA_USDC = makeDepositToken('USDC', {
    id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:usdc',
    name: 'USD Coin',
    network: { name: 'Solana', logo: null },
})
const SOLANA_ADDRESS = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV'

const render = (initialAddress = '') =>
    renderHook(() =>
        useOnrampSenderAddressContent({
            initialAddress,
            sourceToken: SOLANA_USDC,
        }),
    )

describe('useOnrampSenderAddressContent', () => {
    beforeEach(() => {
        mocks.resolve.mockClear()
    })

    it("names the source's chain", () => {
        const { result } = render()

        expect(result.current.networkLabel).toBe('Solana')
    })

    it('accepts an empty entry without an error, since the address is optional', () => {
        const { result } = render()

        expect(result.current.isValid).toBe(true)
        expect(result.current.hasError).toBe(false)
    })

    it("flags an entry that can't be an address on the source's chain", () => {
        const { result } = render()

        act(() => result.current.setAddress('0x1234'))

        expect(result.current.isValid).toBe(false)
        expect(result.current.hasError).toBe(true)
    })

    it('accepts an address on the source chain', () => {
        const { result } = render()

        act(() => result.current.setAddress(SOLANA_ADDRESS))

        expect(result.current.isValid).toBe(true)
        expect(result.current.hasError).toBe(false)
    })

    it('resolves the trimmed address on confirm', () => {
        const { result } = render(`  ${SOLANA_ADDRESS} `)

        act(() => result.current.handleConfirm())

        expect(mocks.resolve).toHaveBeenCalledWith(SOLANA_ADDRESS)
    })

    it('resolves nothing while the entry is invalid', () => {
        const { result } = render('not an address')

        act(() => result.current.handleConfirm())

        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('clears the entry', () => {
        const { result } = render(SOLANA_ADDRESS)

        act(() => result.current.clearAddress())

        expect(result.current.address).toBe('')
    })
})
