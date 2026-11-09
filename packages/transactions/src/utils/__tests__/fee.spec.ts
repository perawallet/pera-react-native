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
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { isFeePaidByAccount } from '../fee'

// The real package needs a platform provider; EVM's codec compares case-blind.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    isSameAddress: (_chainId: string, a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase(),
}))

const ME = '0xabc'

const recordOf = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: '0xhash',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    fee: new Decimal(21_000),
    initiator: ME,
    summary: {
        kind: 'approval',
        title: { key: i18nKey('transactions.list_item.approval') },
        direction: 'none',
        icon: 'approval',
    },
    chainData: { family: 'evm' },
    ...overrides,
})

describe('isFeePaidByAccount', () => {
    it('Given a mined record the account signed, then the account paid its fee', () => {
        expect(isFeePaidByAccount(recordOf(), ME)).toBe(true)
    })

    it('Given the signer in another case, then the account still paid its fee', () => {
        expect(isFeePaidByAccount(recordOf({ initiator: '0xABC' }), ME)).toBe(
            true,
        )
    })

    it('Given a record another address signed, then the account paid nothing', () => {
        expect(isFeePaidByAccount(recordOf({ initiator: '0xdef' }), ME)).toBe(
            false,
        )
    })

    it('Given a pending send the wallet built, which names no signer, then the account paid its fee', () => {
        expect(
            isFeePaidByAccount(
                recordOf({ status: 'pending', initiator: undefined }),
                ME,
            ),
        ).toBe(true)
    })

    it('Given a record with no fee, then the account paid nothing', () => {
        expect(isFeePaidByAccount(recordOf({ fee: undefined }), ME)).toBe(false)
    })

    it('Given no own address, then the account cannot be said to have paid', () => {
        expect(isFeePaidByAccount(recordOf(), '')).toBe(false)
        expect(
            isFeePaidByAccount(
                recordOf({ status: 'pending', initiator: undefined }),
                '',
            ),
        ).toBe(false)
    })

    it('Given a replaced attempt, then it shows no fee', () => {
        expect(
            isFeePaidByAccount(
                recordOf({ status: 'replaced', initiator: undefined }),
                ME,
            ),
        ).toBe(false)
    })

    it('Given a failed attempt the wallet broadcast, which names no signer, then it shows no fee', () => {
        expect(
            isFeePaidByAccount(
                recordOf({ status: 'failed', initiator: undefined }),
                ME,
            ),
        ).toBe(false)
    })

    it('Given a mined call that reverted, which names its signer, then the account paid its fee', () => {
        expect(isFeePaidByAccount(recordOf({ status: 'failed' }), ME)).toBe(
            true,
        )
    })
})
