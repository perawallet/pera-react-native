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

import { beforeEach, describe, it, expect } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import {
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
} from '../getRekeyedUnsignableReason'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { Address } from 'algosdk'
import {
    asUnsignedAlgorandTransaction,
    MAINNET_GENESIS_HASH,
    makeTestAddress,
    makeTestPaymentTx,
    makeUnsignedAlgorandTransaction,
} from './transactions'

const OK_SENDER = makeTestAddress(10).toString()
const REKEYED_EXTERNAL = makeTestAddress(11).toString()
const REKEYED_TO_WATCH = makeTestAddress(12).toString()
const EXTERNAL_AUTH = makeTestAddress(13).toString()
const WATCH_AUTH = makeTestAddress(14).toString()
const UNKNOWN = makeTestAddress(15).toString()

const accounts = [
    {
        id: 'ok',
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: OK_SENDER,
                keyPairId: 'kp-ok',
            },
        },
    },
    {
        id: 'ext',
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: REKEYED_EXTERNAL,
                keyPairId: 'kp-ext',
            },
        },
        rekeyAddress: EXTERNAL_AUTH,
    },
    {
        id: 'rw',
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: REKEYED_TO_WATCH,
                keyPairId: 'kp-rw',
            },
        },
        rekeyAddress: WATCH_AUTH,
    },
    {
        id: 'watch-auth',
        custody: { kind: 'watch' },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: WATCH_AUTH,
            },
        },
    },
] as unknown as WalletAccount[]

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
    seedAuthority(REKEYED_EXTERNAL, EXTERNAL_AUTH)
    seedAuthority(REKEYED_TO_WATCH, WATCH_AUTH)
})

const txRequest = (senders: string[], overrides: object = {}): SignRequest =>
    ({
        id: 'r1',
        type: 'transactions',
        transport: 'network',
        txs: senders.map(sender =>
            asUnsignedAlgorandTransaction(
                makeTestPaymentTx(Address.fromString(sender), {
                    receiver: makeTestAddress(7),
                    genesisHash: MAINNET_GENESIS_HASH,
                }),
            ),
        ),
        ...overrides,
    }) as SignRequest

describe('getRekeyedUnsignableReason', () => {
    it('returns null for a signable sender', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([OK_SENDER]), accounts),
        ).toBeNull()
    })

    it('reports a sender rekeyed to an address not held in the wallet', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([REKEYED_EXTERNAL]), accounts),
        ).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('reports a sender rekeyed to a watch-only account', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([REKEYED_TO_WATCH]), accounts),
        ).toEqual({
            kind: 'authIsWatch',
            senderAddress: REKEYED_TO_WATCH,
            authAddress: WATCH_AUTH,
        })
    })

    it('inspects every transaction, not only the first', () => {
        expect(
            getRekeyedUnsignableReason(
                txRequest([OK_SENDER, REKEYED_EXTERNAL]),
                accounts,
            ),
        ).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('honors per-index signer overrides', () => {
        const request = txRequest([OK_SENDER], {
            chainData: {
                algorand: { signerOverrides: new Map([[0, REKEYED_EXTERNAL]]) },
            },
        })
        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('covers arbitrary-data signers', () => {
        const request = {
            id: 'r1',
            type: 'arbitrary-data',
            data: [{ signer: REKEYED_TO_WATCH }],
        } as unknown as SignRequest
        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authIsWatch',
            senderAddress: REKEYED_TO_WATCH,
            authAddress: WATCH_AUTH,
        })
    })

    it('covers the ARC-60 signer', () => {
        const request = {
            id: 'r1',
            type: 'auth-data',
            authData: { signer: REKEYED_EXTERNAL },
        } as unknown as SignRequest
        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('excludes multisig-cosign requests (they pin a signable participant)', () => {
        expect(
            getRekeyedUnsignableReason(
                txRequest([REKEYED_EXTERNAL], {
                    sourceType: 'multisig-cosign',
                }),
                accounts,
            ),
        ).toBeNull()
    })

    it('ignores senders that are not held accounts', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([UNKNOWN]), accounts),
        ).toBeNull()
    })
})

describe('resolveAllSignerAddresses', () => {
    const SENDER = makeTestAddress(5)
    const AUTH = makeTestAddress(6).toString()
    const neutralRequest = (overrides: object = {}): SignRequest =>
        ({
            id: 'req-neutral',
            type: 'transactions',
            transport: 'network',
            txs: [1n, 2n].map(amount =>
                asUnsignedAlgorandTransaction(
                    makeTestPaymentTx(SENDER, {
                        receiver: makeTestAddress(7),
                        amount,
                        genesisHash: MAINNET_GENESIS_HASH,
                    }),
                ),
            ),
            ...overrides,
        }) as SignRequest

    it("names a chain-neutral request's Algorand senders", () => {
        expect(resolveAllSignerAddresses(neutralRequest())).toEqual([
            SENDER.toString(),
            SENDER.toString(),
        ])
    })

    it('names the signer its Algorand group facts give instead of the sender', () => {
        const request = neutralRequest({
            chainData: {
                algorand: { signerOverrides: new Map([[1, AUTH]]) },
            },
        })

        expect(resolveAllSignerAddresses(request)).toEqual([
            SENDER.toString(),
            AUTH,
        ])
    })

    it("names no signers for a chain-neutral payload it can't read", () => {
        const request = {
            id: 'req-neutral',
            type: 'transactions',
            transport: 'network',
            txs: [makeUnsignedAlgorandTransaction()],
        } as SignRequest

        expect(resolveAllSignerAddresses(request)).toEqual([])
    })
})
