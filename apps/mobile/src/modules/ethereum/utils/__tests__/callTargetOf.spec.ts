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
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { callTargetOf } from '../callTargetOf'

const ME = '0x00000000000000000000000000000000000000aa'
const POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'

const call = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: '0xhash',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    initiator: ME,
    summary: {
        kind: 'contract-call',
        title: { key: i18nKey('transactions.list_item.supply') },
        direction: 'none',
        icon: 'contract-call',
        counterparty: POOL,
    },
    chainData: { family: 'evm' },
    ...overrides,
})

describe('callTargetOf', () => {
    it('names the contract a call the account made went to', () => {
        expect(callTargetOf(call(), ME, undefined)).toBe(POOL)
    })

    it('names it for a send still pending, which is the wallet’s own by definition', () => {
        expect(
            callTargetOf(
                call({ status: 'pending', initiator: undefined }),
                ME,
                undefined,
            ),
        ).toBe(POOL)
    })

    it.each([
        ['another signer’s call', call({ initiator: POOL })],
        [
            'a plain transfer',
            call({
                summary: { ...call().summary, kind: 'transfer', icon: 'send' },
            }),
        ],
    ])('names none for %s', (_label, record) => {
        expect(callTargetOf(record, ME, undefined)).toBeUndefined()
    })

    it('names none once the read body has the call, which names it itself', () => {
        expect(
            callTargetOf(call(), ME, {} as EthereumTransactionPresentation),
        ).toBeUndefined()
    })
})
