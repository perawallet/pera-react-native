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

import { describe, expect, test } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isSwapPayerInWallet } from '../isSwapPayerInWallet'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const account = (address: string) =>
    ({
        id: address,
        chains: { algorand: { address } },
    }) as unknown as WalletAccount

describe('swaps/isSwapPayerInWallet', () => {
    test('is true while the paying account is in the wallet', () => {
        expect(
            isSwapPayerInWallet(
                { sourceScope: SCOPE, sourceAddress: 'PAYER' },
                [account('OTHER'), account('PAYER')],
            ),
        ).toBe(true)
    })

    test('is false once the paying account has left', () => {
        expect(
            isSwapPayerInWallet(
                { sourceScope: SCOPE, sourceAddress: 'PAYER' },
                [account('OTHER')],
            ),
        ).toBe(false)
    })
})
