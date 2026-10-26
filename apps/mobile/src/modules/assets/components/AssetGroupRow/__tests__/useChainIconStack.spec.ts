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
import { describe, expect, it } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChainIconStack } from '../useChainIconStack'

// Only two chains are registered today; the stack has to cope with more.
const chains = (...ids: string[]) => ids as ChainId[]

describe('useChainIconStack', () => {
    it('shows every chain up to three', () => {
        const { result } = renderHook(() =>
            useChainIconStack(chains('algorand', 'ethereum')),
        )

        expect(result.current).toEqual({
            visibleChainIds: ['algorand', 'ethereum'],
            hiddenCount: 0,
        })
    })

    it('shows exactly three chains with no "+N"', () => {
        const { result } = renderHook(() =>
            useChainIconStack(chains('algorand', 'ethereum', 'base')),
        )

        expect(result.current.hiddenCount).toBe(0)
    })

    it('shows three chains and counts the rest', () => {
        const { result } = renderHook(() =>
            useChainIconStack(
                chains('algorand', 'ethereum', 'base', 'polygon', 'solana'),
            ),
        )

        expect(result.current).toEqual({
            visibleChainIds: ['algorand', 'ethereum', 'base'],
            hiddenCount: 2,
        })
    })
})
