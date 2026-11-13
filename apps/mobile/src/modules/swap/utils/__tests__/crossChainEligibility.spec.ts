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

import { describe, expect, it, vi } from 'vitest'
import {
    canSignWith,
    isMultisigAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    canReceiveCrossChain,
    canSwapCrossChain,
} from '../crossChainEligibility'

const account = (chains: WalletAccount['chains']): WalletAccount => ({
    id: 'a',
    name: '',
    custody: { kind: 'local', seed: null },
    chains,
})

describe('canReceiveCrossChain', () => {
    it('needs an address on the chain even when custody could sign there', () => {
        vi.mocked(canSignWith).mockReturnValue(true)

        expect(
            canReceiveCrossChain(
                account({ algorand: { address: 'A', keyPairId: 'k' } }),
                [],
                'ethereum',
            ),
        ).toBe(false)
    })

    it('needs a signer on the chain', () => {
        vi.mocked(canSignWith).mockReturnValue(false)

        expect(
            canReceiveCrossChain(
                account({ ethereum: { address: '0x1' } }),
                [],
                'ethereum',
            ),
        ).toBe(false)
    })

    it('accepts an account with an address and a signer there', () => {
        vi.mocked(canSignWith).mockReturnValue(true)

        expect(
            canReceiveCrossChain(
                account({ ethereum: { address: '0x1', keyPairId: 'k' } }),
                [],
                'ethereum',
            ),
        ).toBe(true)
    })
})

describe('canSwapCrossChain', () => {
    it('keeps a shared account on its own chain', () => {
        vi.mocked(isMultisigAccount).mockReturnValue(true)

        expect(canSwapCrossChain(account({}))).toBe(false)
    })
})
