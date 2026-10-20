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
import { getAddress } from 'viem'
import type {
    TransactionSummary,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import { createEvmSigningReviewerAdapter } from '../signingReviewer'
import { ETHEREUM } from '../../__tests__/evm-chains'

const reviewer = createEvmSigningReviewerAdapter(ETHEREUM)
import { readEthereumNative } from '../transaction-view'
import { SENDER, TRANSFER } from './fixtures'

const SUMMARY = { kind: 'unknown' } as unknown as TransactionSummary

const unsigned = (from: string = SENDER): UnsignedTransaction => ({
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    payload: { from, transaction: TRANSFER },
    summary: SUMMARY,
    chainData: { family: 'evm' },
})

const nativeOf = (transaction: UnsignedTransaction) => {
    const native = reviewer.toTransactionNative(transaction)
    if (!native) throw new Error('unreadable')
    return native
}

describe('ethereumSigningReviewerAdapter', () => {
    it('reads a reviewable transaction into the Ethereum view', () => {
        const view = readEthereumNative(nativeOf(unsigned()))

        expect(view).toMatchObject({
            kind: 'transfer',
            from: getAddress(SENDER),
            nonce: 0,
        })
    })

    it('reads a payload review would refuse, or an Algorand-shaped transaction, as null', () => {
        const noGas = {
            ...unsigned(),
            payload: {
                from: SENDER,
                transaction: { ...TRANSFER, gas: undefined },
            },
        }

        expect(reviewer.toTransactionNative(noGas)).toBeNull()
        expect(
            reviewer.toTransactionNative({
                txn: {},
            } as unknown as UnsignedTransaction),
        ).toBeNull()
    })

    it('lists each transaction on its own and marks the unsigned slots external', () => {
        const natives = [nativeOf(unsigned()), nativeOf(unsigned())]

        const items = reviewer.createTransactionListItems(natives, new Set([0]))

        expect(
            items.map(item => item.type === 'transaction' && item.isExternal),
        ).toEqual([false, true])
        expect(reviewer.classifyRequestStructure(items)).toBe('list')
        expect(reviewer.classifyRequestStructure(items.slice(0, 1))).toBe(
            'single',
        )
    })

    it('names the sender of each readable transaction as a signer and skips an unreadable one', () => {
        const request = {
            type: 'transactions',
            txs: [unsigned(), { ...unsigned(), payload: {} }],
        } as unknown as TransactionSignRequest

        expect(reviewer.resolveAllSignerAddresses(request)).toEqual([
            getAddress(SENDER),
        ])
    })

    it('shows non-hex data and binary hex as hex, and printable hex as text', () => {
        expect(reviewer.decodeArbitraryDataForDisplay('hi')).toEqual({
            kind: 'hex',
            hex: '0x6869',
        })
        expect(reviewer.decodeArbitraryDataForDisplay('0x6869')).toEqual({
            kind: 'text',
            text: 'hi',
        })
        expect(reviewer.decodeArbitraryDataForDisplay('0xff00')).toEqual({
            kind: 'hex',
            hex: '0xff00',
        })
    })

    it('has no rekey reason and adds no warnings beyond the reviewer', () => {
        expect(
            reviewer.getDelegatedUnsignableReason({} as never, []),
        ).toBeNull()
        expect(
            reviewer.aggregateTransactionWarnings([], new Set(), new Set()),
        ).toEqual([])
    })
})
