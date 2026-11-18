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
import { useSwapSourceChainsByAccount } from '../useSwapSourceChainsByAccount'

const SOURCE_CHAINS: Record<string, string[]> = {
    first: ['algorand', 'ethereum'],
    second: ['ethereum', 'base'],
}

vi.mock('../useSwapScope', () => ({
    useSwapSigningAccounts: () =>
        Object.keys(SOURCE_CHAINS).map(id => ({ id })),
}))

vi.mock('../useSwapSourceChainsResolver', () => ({
    useSwapSourceChainsResolver: () => (account: { id: string }) =>
        SOURCE_CHAINS[account.id] ?? [],
}))

describe('swaps/useSwapSourceChainsByAccount', () => {
    test('maps each swap account to the chains it can pay from, and lists every chain once', () => {
        const { result } = renderHook(() => useSwapSourceChainsByAccount())

        expect(result.current.accounts.map(account => account.id)).toEqual([
            'first',
            'second',
        ])
        expect(result.current.sourceChainsByAccount.get('second')).toEqual([
            'ethereum',
            'base',
        ])
        expect(result.current.sourceChainIds).toEqual([
            'algorand',
            'ethereum',
            'base',
        ])
    })
})
