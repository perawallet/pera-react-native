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

import { describe, expect, test, vi } from 'vitest'
import { Address } from 'algosdk'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import type { LocalKeySigningDeps } from '@perawallet/wallet-core-signing'
import {
    SIGN_BATCH_SIZE,
    signTransactionsWithLocalKey,
} from '../signTransactionsWithLocalKey'

const SENDER = 'B3FCOSKVDPADAVJ6LXZKAMXDC4DFNLPOINGM2ZDSAKEBVG4LJVRTPJ22QY'
const OTHER = 'SMYOGL34R6IPDMI6TGHYDDWIGH6Z3EDGTNDKLWYVHPGDTW5D5XAYGKY25U'

const txn = (id: number): PeraTransaction =>
    ({
        sender: Address.fromString(SENDER),
        id,
        bytesToSign: () => new Uint8Array([2, id]),
    }) as unknown as PeraTransaction

const algo25Account = (address = SENDER): WalletAccount => ({
    id: 'acct',
    type: AccountTypes.algo25,
    address,
    keyPairId: 'key-1',
})

const deps = (
    overrides: Partial<LocalKeySigningDeps> = {},
): LocalKeySigningDeps => ({
    signPayloads: vi.fn(async (_keyPairId, payloads) =>
        payloads.map((_, index) => new Uint8Array([index])),
    ),
    getPQSigningInfo: () => null,
    yieldBetweenBatches: vi.fn(async () => undefined),
    ...overrides,
})

describe('signTransactionsWithLocalKey', () => {
    test('signs only the requested indices and leaves the rest unsigned', async () => {
        const group = [txn(0), txn(1), txn(2)]

        const result = await signTransactionsWithLocalKey(
            deps(),
            group,
            [2, 0],
            algo25Account(),
        )

        expect(result).toHaveLength(3)
        expect(result[1].sig).toBeUndefined()
        // Signatures land in the slots named by `indexesToSign`, in the order
        // those indices were given — not in group order.
        expect(result[2].sig).toEqual(new Uint8Array([0]))
        expect(result[0].sig).toEqual(new Uint8Array([1]))
    })

    test('sets sgnr only when the signer is not the sender', async () => {
        const signedBySender = await signTransactionsWithLocalKey(
            deps(),
            [txn(0)],
            [0],
            algo25Account(),
        )
        const signedByAuth = await signTransactionsWithLocalKey(
            deps(),
            [txn(0)],
            [0],
            algo25Account(OTHER),
        )

        expect(signedBySender[0].sgnr).toBeUndefined()
        expect(signedByAuth[0].sgnr?.toString()).toBe(OTHER)
    })

    test('resolves the signing scheme once per call, not once per batch', async () => {
        const getPQSigningInfo = vi.fn(() => null)
        const group = Array.from({ length: SIGN_BATCH_SIZE * 2 + 1 }, (_, i) =>
            txn(i),
        )

        await signTransactionsWithLocalKey(
            deps({ getPQSigningInfo }),
            group,
            group.map((_, index) => index),
            algo25Account(),
        )

        expect(getPQSigningInfo).toHaveBeenCalledTimes(1)
    })

    // Yielding before the first chunk would cost every single-transaction sign
    // an extra tick, which is the snappy path the batching exists to protect.
    test('yields between batches but never before the first', async () => {
        const yieldBetweenBatches = vi.fn(async () => undefined)
        const group = Array.from({ length: SIGN_BATCH_SIZE * 2 + 1 }, (_, i) =>
            txn(i),
        )

        await signTransactionsWithLocalKey(
            deps({ yieldBetweenBatches }),
            group,
            group.map((_, index) => index),
            algo25Account(),
        )

        expect(yieldBetweenBatches).toHaveBeenCalledTimes(2)

        yieldBetweenBatches.mockClear()
        await signTransactionsWithLocalKey(
            deps({ yieldBetweenBatches }),
            [txn(0)],
            [0],
            algo25Account(),
        )
        expect(yieldBetweenBatches).not.toHaveBeenCalled()
    })

    test('signs the PQ payload and fills pqsig for a quantum key', async () => {
        const getPQSigningInfo = () => ({
            schemeId: 'falcon1024' as const,
            publicKey: new Uint8Array(1793).fill(10),
        })

        const [signed] = await signTransactionsWithLocalKey(
            deps({ getPQSigningInfo }),
            [txn(0)],
            [0],
            { ...algo25Account(), type: AccountTypes.quantum },
        )

        expect(signed.pqsig).toBeDefined()
        expect(signed.sig).toBeUndefined()
    })

    test('rejects an account type with no local signing key', async () => {
        await expect(
            signTransactionsWithLocalKey(deps(), [txn(0)], [0], {
                ...algo25Account(),
                type: AccountTypes.watch,
            } as WalletAccount),
        ).rejects.toBeTruthy()
    })

    test('signs with the key of the account it is given', async () => {
        const signPayloads = vi.fn(async (_keyPairId, payloads: Uint8Array[]) =>
            payloads.map(() => new Uint8Array([9])),
        )

        await signTransactionsWithLocalKey(
            deps({ signPayloads }),
            [txn(0)],
            [0],
            { ...algo25Account(), keyPairId: 'key-for-this-account' },
        )

        expect(signPayloads).toHaveBeenCalledWith('key-for-this-account', [
            new Uint8Array([2, 0]),
        ])
    })

    test('pairs each signature with its own transaction across batches', async () => {
        const group = Array.from({ length: SIGN_BATCH_SIZE + 3 }, (_, i) =>
            txn(i),
        )
        const signPayloads = vi.fn(async (_keyPairId, payloads: Uint8Array[]) =>
            payloads.map(payload => new Uint8Array([payload[1] + 100])),
        )

        const result = await signTransactionsWithLocalKey(
            deps({ signPayloads }),
            group,
            group.map((_, index) => index),
            algo25Account(),
        )

        expect(result.map(stx => stx.sig?.[0])).toEqual(
            group.map((_, index) => index + 100),
        )
    })

    test('rejects a hardware-wallet account, which signs through the pipeline', async () => {
        await expect(
            signTransactionsWithLocalKey(deps(), [txn(0)], [0], {
                ...algo25Account(),
                type: AccountTypes.hardware,
            } as unknown as WalletAccount),
        ).rejects.toBeTruthy()
    })
})
