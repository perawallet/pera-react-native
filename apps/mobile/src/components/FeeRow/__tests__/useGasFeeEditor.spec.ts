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
import { act, renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useGasFeeEditor } from '../useGasFeeEditor'

const l1Chains = vi.hoisted(() => new Set(['base']))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainHasL1DataFee: (chainId: string) => l1Chains.has(chainId),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

describe('useGasFeeEditor', () => {
    it('starts closed', () => {
        const { result } = renderHook(() =>
            useGasFeeEditor({ scope: SCOPE, onPresetChange: vi.fn() }),
        )

        expect(result.current.isExpanded).toBe(false)
    })

    it('opens and closes as the toggle is called', () => {
        const { result } = renderHook(() =>
            useGasFeeEditor({ scope: SCOPE, onPresetChange: vi.fn() }),
        )

        act(() => result.current.toggleExpanded())
        expect(result.current.isExpanded).toBe(true)

        act(() => result.current.toggleExpanded())
        expect(result.current.isExpanded).toBe(false)
    })

    it('reports the chosen speed once and closes the list', () => {
        const onPresetChange = vi.fn()
        const { result } = renderHook(() =>
            useGasFeeEditor({ scope: SCOPE, onPresetChange }),
        )
        act(() => result.current.toggleExpanded())

        act(() => result.current.selectPreset('fast'))

        expect(onPresetChange).toHaveBeenCalledTimes(1)
        expect(onPresetChange).toHaveBeenCalledWith('fast')
        expect(result.current.isExpanded).toBe(false)
    })

    it('closes and reports again when the speed in use is chosen', () => {
        const onPresetChange = vi.fn()
        const { result } = renderHook(() =>
            useGasFeeEditor({ scope: SCOPE, onPresetChange }),
        )
        act(() => result.current.toggleExpanded())

        act(() => result.current.selectPreset('normal'))

        expect(onPresetChange).toHaveBeenCalledWith('normal')
        expect(result.current.isExpanded).toBe(false)
    })

    it.each([
        ['base', true],
        ['ethereum', false],
    ] as const)(
        'says whether the max fee on %s includes an L1 data fee',
        (chainId, expected) => {
            const { result } = renderHook(() =>
                useGasFeeEditor({
                    scope: { chainId, networkId: 'mainnet' },
                    onPresetChange: vi.fn(),
                }),
            )

            expect(result.current.hasL1DataFee).toBe(expected)
        },
    )
})
