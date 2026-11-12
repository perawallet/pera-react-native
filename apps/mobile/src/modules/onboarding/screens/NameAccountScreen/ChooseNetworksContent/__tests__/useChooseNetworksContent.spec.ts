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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChooseNetworksContent } from '../useChooseNetworksContent'

const mockOnChange = vi.fn()

const renderChooser = (selected: ChainId[], required: ChainId[]) =>
    renderHook(() =>
        useChooseNetworksContent({
            selectedChainIds: selected,
            requiredChainIds: required,
            onChange: mockOnChange,
        }),
    )

describe('useChooseNetworksContent', () => {
    beforeEach(() => {
        mockOnChange.mockClear()
    })

    it('toggles a chain on and off, reporting the selection after each toggle', () => {
        const { result } = renderChooser(['algorand', 'ethereum'], ['algorand'])

        act(() => result.current.handleToggle('ethereum'))
        act(() => result.current.handleToggle('base'))

        expect(result.current.isSelected('ethereum')).toBe(false)
        expect(result.current.isSelected('base')).toBe(true)
        expect(mockOnChange).toHaveBeenNthCalledWith(1, ['algorand'])
        expect(mockOnChange).toHaveBeenLastCalledWith(['algorand', 'base'])
    })

    it('never deselects the last chain selected', () => {
        const { result } = renderChooser(['algorand', 'ethereum'], [])

        act(() => result.current.handleToggle('algorand'))
        act(() => result.current.handleToggle('ethereum'))

        expect(result.current.canToggle('ethereum')).toBe(false)
        expect(result.current.isSelected('ethereum')).toBe(true)
        expect(mockOnChange).toHaveBeenCalledTimes(1)
        expect(mockOnChange).toHaveBeenLastCalledWith(['ethereum'])
    })

    it('never deselects a required chain', () => {
        const { result } = renderChooser(['algorand'], ['algorand'])

        act(() => result.current.handleToggle('algorand'))

        expect(result.current.isRequired('algorand')).toBe(true)
        expect(result.current.isSelected('algorand')).toBe(true)
    })
})
