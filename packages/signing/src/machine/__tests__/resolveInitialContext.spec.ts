/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi } from 'vitest'
import { Address } from '@algorandfoundation/algokit-utils/common'
import {
    Transaction,
    TransactionType,
    groupTransactions,
} from '@algorandfoundation/algokit-utils/transact'

import { resolveInitialContext } from '../actions'
import type { SigningMachineInput } from '../context'
import type { TransactionSignRequest } from '../../models'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { InvalidSignableDataError } from '../../pipeline/errors'

const baseParams = {
    fee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisId: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(0xab),
}

const userAddr = new Address(new Uint8Array(32).fill(1))
const dappAddr = new Address(new Uint8Array(32).fill(2))

const makePayment = (sender: Address, amount: bigint): Transaction =>
    new Transaction({
        type: TransactionType.Payment,
        sender,
        ...baseParams,
        payment: { receiver: dappAddr, amount },
    })

const userAccount = {
    type: 'algo25',
    address: userAddr.toString(),
    keyPairId: 'key-1',
} as unknown as WalletAccount

const baseInput = (request: TransactionSignRequest): SigningMachineInput =>
    ({
        request,
        allAccounts: [userAccount],
        signTransactions: vi.fn(),
        signArbitraryData: vi.fn(),
        signArc60: vi.fn(),
        createTransport: vi.fn(),
        network: 'mainnet' as never,
        encodeTransaction: vi.fn(),
    }) as unknown as SigningMachineInput

describe('resolveInitialContext — group integrity validation', () => {
    it('passes when txs is the wallet subset and groupContext carries the full atomic group', () => {
        // Express-send shape: 2-tx atomic group, user signs only their tx.
        // Without groupContext the validator would see [userTx] and reject
        // it as a partial group. With groupContext it sees the full pair
        // and passes.
        const fullGroup = groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(dappAddr, 0n),
        ])
        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: [fullGroup[0]],
            groupContext: fullGroup,
        }

        expect(() => resolveInitialContext(baseInput(request))).not.toThrow()
    })

    it('falls back to validating txs when groupContext is unset', () => {
        // Internal-source shape: txs is the full group, no groupContext.
        const fullGroup = groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(userAddr, 2n),
        ])
        const request: TransactionSignRequest = {
            id: 'req-2',
            type: 'transactions',
            transport: 'algod',
            txs: fullGroup,
        }

        expect(() => resolveInitialContext(baseInput(request))).not.toThrow()
    })

    it('throws when groupContext itself is a stale/partial group', () => {
        // dApp sent a 3-tx group with one tx removed before forwarding —
        // the survivors still carry the original group hash, so recompute
        // over the survivors won't match.
        const fullGroup = groupTransactions([
            makePayment(userAddr, 1n),
            makePayment(userAddr, 2n),
            makePayment(userAddr, 3n),
        ])
        const stale = [fullGroup[0], fullGroup[1]]
        const request: TransactionSignRequest = {
            id: 'req-3',
            type: 'transactions',
            transport: 'callback',
            sourceType: 'walletconnect',
            txs: [stale[0]],
            groupContext: stale,
        }

        expect(() => resolveInitialContext(baseInput(request))).toThrow(
            InvalidSignableDataError,
        )
    })
})
