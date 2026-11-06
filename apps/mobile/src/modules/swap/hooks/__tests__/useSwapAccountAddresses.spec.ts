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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapAccountAddresses } from '../useSwapAccountAddresses'

const TWO_CHAIN: WalletAccount = {
    id: 'both',
    name: '',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: 'ALGO_ADDR', keyPairId: 'k1' },
        ethereum: { address: '0xETH', keyPairId: 'k2' },
    },
}

describe('useSwapAccountAddresses', () => {
    it('lists the account on every swap chain it has an address on', () => {
        const { result } = renderHook(() => useSwapAccountAddresses(TWO_CHAIN))

        expect(result.current.map(entry => entry.address)).toEqual([
            'ALGO_ADDR',
            '0xETH',
        ])
        expect(result.current[1].scope.chainId).toBe('ethereum')
    })

    it('lists nothing without an account', () => {
        const { result } = renderHook(() => useSwapAccountAddresses(null))

        expect(result.current).toEqual([])
    })
})
