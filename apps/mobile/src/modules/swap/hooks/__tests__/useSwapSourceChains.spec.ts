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
import { describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapSourceChains } from '../useSwapSourceChains'

const sourceChainsOf = vi.hoisted(() => vi.fn(() => ['algorand', 'base']))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapSourceChainsResolver: () => sourceChainsOf,
}))

const ACCOUNT = { id: 'account' } as unknown as WalletAccount

describe('useSwapSourceChains', () => {
    it("resolves the account's swap source chains", () => {
        const { result } = renderHook(() => useSwapSourceChains(ACCOUNT))

        expect(result.current).toEqual(['algorand', 'base'])
    })

    it('has no chains without an account', () => {
        sourceChainsOf.mockClear()

        const { result } = renderHook(() => useSwapSourceChains(null))

        expect(result.current).toEqual([])
        expect(sourceChainsOf).not.toHaveBeenCalled()
    })
})
