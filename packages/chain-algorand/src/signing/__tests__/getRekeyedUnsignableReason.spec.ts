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
import { makeUnsignedAlgorandTransaction } from './transactions'

const OK_SENDER = 'OK_SENDER'
const REKEYED_EXTERNAL = 'REKEYED_EXTERNAL'
const REKEYED_TO_WATCH = 'REKEYED_TO_WATCH'
const EXTERNAL_AUTH = 'EXTERNAL_AUTH'
const WATCH_AUTH = 'WATCH_AUTH'

const accounts = [
    {
        id: 'ok',
        address: OK_SENDER,
        custody: { kind: 'local', seed: null },
        keyPairId: 'kp-ok',
    },
    {
        id: 'ext',
        address: REKEYED_EXTERNAL,
        custody: { kind: 'local', seed: null },
        keyPairId: 'kp-ext',
    },
    {
        id: 'rw',
        address: REKEYED_TO_WATCH,
        custody: { kind: 'local', seed: null },
        keyPairId: 'kp-rw',
    },
    {
        id: 'watch-auth',
        address: WATCH_AUTH,
        custody: { kind: 'watch' },
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
        txs: senders.map(sender => ({ sender })),
        ...overrides,
    }) as unknown as SignRequest

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
            signerOverrides: new Map([[0, REKEYED_EXTERNAL]]),
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
            getRekeyedUnsignableReason(txRequest(['UNKNOWN']), accounts),
        ).toBeNull()
    })
})

describe('resolveAllSignerAddresses', () => {
    it("names no signers for a chain-neutral request, whose chain's planner names them", () => {
        const request = {
            id: 'req-neutral',
            type: 'transactions',
            transport: 'algod',
            txs: [makeUnsignedAlgorandTransaction()],
        } as SignRequest

        expect(resolveAllSignerAddresses(request)).toEqual([])
    })
})
