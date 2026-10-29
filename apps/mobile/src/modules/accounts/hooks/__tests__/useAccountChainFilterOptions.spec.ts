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

import { describe, expect, it } from 'vitest'
import { renderHook } from '@test-utils/render'
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import { useAccountChainFilterOptions } from '../useAccountChainFilterOptions'

const algorand: AccountHoldingSource = {
    address: 'ALGO_ADDRESS',
    scope: { chainId: 'algorand', networkId: 'mainnet' },
}
const base: AccountHoldingSource = {
    address: '0xabc',
    scope: { chainId: 'base', networkId: 'mainnet' },
}

describe('useAccountChainFilterOptions', () => {
    it('offers All and one chip per network, test ids under the given prefix', () => {
        const { result } = renderHook(() =>
            useAccountChainFilterOptions([algorand, base], 'history_filter'),
        )

        expect(
            result.current.map(({ value, testID }) => ({ value, testID })),
        ).toEqual([
            { value: null, testID: 'history_filter_all' },
            { value: 'algorand', testID: 'history_filter_algorand' },
            { value: 'base', testID: 'history_filter_base' },
        ])
    })

    it('offers no chips on a single-network account', () => {
        const { result } = renderHook(() =>
            useAccountChainFilterOptions([algorand], 'history_filter'),
        )

        expect(result.current).toEqual([])
    })
})
