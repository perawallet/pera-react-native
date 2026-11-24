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
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { isSentByOtherSigner, recordSignerOf } from '../signer'

const ME = '0xabc'
const OTHER = '0xdef'

const recordOf = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: '0xhash',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    summary: {
        kind: 'token-transfer',
        title: { key: i18nKey('transactions.list_item.approval') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
    ...overrides,
})

describe('recordSignerOf', () => {
    it.each([ME, OTHER])(
        'Given the record names %s as its initiator, then that is the signer',
        initiator => {
            expect(recordSignerOf(recordOf({ initiator }), ME)).toBe(initiator)
        },
    )

    it.each(['pending', 'replaced', 'failed'] as const)(
        'Given a %s record with no initiator, then the account is the signer',
        status => {
            expect(recordSignerOf(recordOf({ status }), ME)).toBe(ME)
        },
    )

    it("Given a confirmed record of the wallet's own send, which names the account, then the account is the signer", () => {
        expect(
            recordSignerOf(
                recordOf({ initiator: ME, status: 'confirmed' }),
                ME,
            ),
        ).toBe(ME)
    })

    it('Given a confirmed record with no initiator, then nobody is the signer', () => {
        expect(recordSignerOf(recordOf(), ME)).toBeUndefined()
    })

    it('Given no account address, then a pending record has no signer', () => {
        expect(
            recordSignerOf(recordOf({ status: 'pending' }), ''),
        ).toBeUndefined()
    })
})

describe('isSentByOtherSigner', () => {
    const outgoing = recordOf().summary
    const incoming = { ...outgoing, direction: 'in' as const }
    const input = {
        summary: outgoing,
        signer: undefined,
        accountAddress: ME,
        chainId: 'ethereum' as const,
    }

    it('Given an outgoing entry another address signed, then it was sent by another signer', () => {
        expect(isSentByOtherSigner({ ...input, signer: OTHER })).toBe(true)
    })

    it('Given an outgoing entry known to be signed elsewhere, then it was sent by another signer', () => {
        expect(isSentByOtherSigner({ ...input, isSignedElsewhere: true })).toBe(
            true,
        )
    })

    it('Given an outgoing entry with no signer, then it counts as the own', () => {
        expect(isSentByOtherSigner(input)).toBe(false)
    })

    it('Given the account as signer, then it is not another signer', () => {
        expect(isSentByOtherSigner({ ...input, signer: ME })).toBe(false)
    })

    it('Given an incoming entry signed by another address, then it is not a send', () => {
        expect(
            isSentByOtherSigner({ ...input, summary: incoming, signer: OTHER }),
        ).toBe(false)
    })

    it('Given no account address, then it is not another signer', () => {
        expect(
            isSentByOtherSigner({
                ...input,
                signer: OTHER,
                accountAddress: '',
            }),
        ).toBe(false)
    })
})
