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

import { describe, it, expect } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { SignRequest } from '../../models'
import { getRekeyedUnsignableReason } from '../getRekeyedUnsignableReason'

const OK_SENDER = 'OK_SENDER'
const REKEYED_EXTERNAL = 'REKEYED_EXTERNAL'
const REKEYED_TO_WATCH = 'REKEYED_TO_WATCH'
const EXTERNAL_AUTH = 'EXTERNAL_AUTH'
const WATCH_AUTH = 'WATCH_AUTH'

const accounts = [
    {
        id: 'ok',
        address: OK_SENDER,
        type: AccountTypes.algo25,
        keyPairId: 'kp-ok',
    },
    {
        id: 'ext',
        address: REKEYED_EXTERNAL,
        type: AccountTypes.algo25,
        keyPairId: 'kp-ext',
        rekeyAddress: EXTERNAL_AUTH,
    },
    {
        id: 'rw',
        address: REKEYED_TO_WATCH,
        type: AccountTypes.algo25,
        keyPairId: 'kp-rw',
        rekeyAddress: WATCH_AUTH,
    },
    {
        id: 'watch-auth',
        address: WATCH_AUTH,
        type: AccountTypes.watch,
    },
] as unknown as WalletAccount[]

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
            type: 'arc60',
            stdSigData: { signer: REKEYED_EXTERNAL },
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
