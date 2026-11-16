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

// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapSourceChainsResolver } from '../useSwapSourceChainsResolver'

const mocks = vi.hoisted(() => ({
    resolver: vi.fn(),
    optionsOf: vi.fn(() => [
        { chainId: 'algorand', isEnabled: true },
        { chainId: 'ethereum', isEnabled: false },
        { chainId: 'base', isEnabled: true },
    ]),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountChainOptionsResolver: (...args: unknown[]) => {
        mocks.resolver(...args)
        return mocks.optionsOf
    },
}))

const ACCOUNT = { id: 'account' } as unknown as WalletAccount

describe('swaps/useSwapSourceChainsResolver', () => {
    test('asks only for chains the account can sign a swap on, keeping the enabled ones', () => {
        const { result } = renderHook(() => useSwapSourceChainsResolver())

        expect(result.current(ACCOUNT)).toEqual(['algorand', 'base'])
        expect(mocks.resolver).toHaveBeenCalledWith('swap', {
            isSignerRequired: true,
        })
    })
})
