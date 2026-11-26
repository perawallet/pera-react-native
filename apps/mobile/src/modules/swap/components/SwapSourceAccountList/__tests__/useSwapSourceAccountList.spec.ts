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
import type { AccountChainAssetBalance } from '@perawallet/wallet-core-accounts'
import type { SwapPayHolding } from '@perawallet/wallet-core-swaps'
import { useSwapSourceAccountList } from '../useSwapSourceAccountList'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [
        { id: 'first', name: 'First' },
        { id: 'second', name: 'Second' },
    ],
}))

const holder = (accountId: string) =>
    ({ accountId, assetId: 'usdc' }) as AccountChainAssetBalance

describe('useSwapSourceAccountList', () => {
    it('pairs each holder with its account, in the holding order, skipping a removed account', () => {
        const holding = {
            holders: [holder('second'), holder('gone'), holder('first')],
        } as SwapPayHolding

        const { result } = renderHook(() => useSwapSourceAccountList(holding))

        expect(
            result.current.options.map(({ account, holding: held }) => [
                account.id,
                held.accountId,
            ]),
        ).toEqual([
            ['second', 'second'],
            ['first', 'first'],
        ])
    })
})
