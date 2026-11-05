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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useAccountChainOptionsResolver,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useSwapSourceChains } from '../useSwapSourceChains'

const ACCOUNT = { id: 'account' } as unknown as WalletAccount

describe('useSwapSourceChains', () => {
    const optionsOf = vi.fn()

    beforeEach(() => {
        optionsOf.mockReset()
        vi.mocked(useAccountChainOptionsResolver).mockReturnValue(optionsOf)
    })

    it('asks only for chains the account can sign a swap on', () => {
        optionsOf.mockReturnValue([])

        renderHook(() => useSwapSourceChains(ACCOUNT))

        expect(useAccountChainOptionsResolver).toHaveBeenCalledWith('swap', {
            isSignerRequired: true,
        })
    })

    it('keeps the enabled chains', () => {
        optionsOf.mockReturnValue([
            { chainId: 'algorand', isEnabled: true },
            { chainId: 'ethereum', isEnabled: false },
            { chainId: 'base', isEnabled: true },
        ])

        const { result } = renderHook(() => useSwapSourceChains(ACCOUNT))

        expect(result.current).toEqual(['algorand', 'base'])
    })

    it('has no chains without an account', () => {
        const { result } = renderHook(() => useSwapSourceChains(null))

        expect(result.current).toEqual([])
        expect(optionsOf).not.toHaveBeenCalled()
    })
})
