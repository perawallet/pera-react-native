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
    ARC0001_MAX_TXN_B64_LENGTH,
    Arc0001Error,
    Arc0001ErrorCode,
} from '@perawallet/wallet-core-blockchain'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import {
    CannotSignError,
    MAX_TRANSACTION_SIGN_REQUESTS,
    NoLocalParticipantsError,
    SourceError,
    TransportError,
    UserCancelledError,
} from '@perawallet/wallet-core-signing'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandDappRequestAdapter as adapter } from '../dappRequestAdapter'

const signTxns = (txns: unknown) =>
    adapter.parseSigningParams('sign-transactions', { txns })

describe('algorandDappRequestAdapter', () => {
    it('is keyed by the Algorand chain id', () => {
        expect(adapter.chainId).toBe(ALGORAND_CHAIN_ID)
    })

    describe('parseSigningParams', () => {
        it('passes the txns array through as the payload', () => {
            const txns = [{ txn: 'AA==' }]

            expect(signTxns(txns)).toEqual({ ok: true, payload: txns })
        })

        it('accepts the largest permitted transaction count and base64 length', () => {
            const atCount = Array.from(
                { length: MAX_TRANSACTION_SIGN_REQUESTS },
                () => ({ txn: 'AA==' }),
            )
            const atLength = [{ txn: 'A'.repeat(ARC0001_MAX_TXN_B64_LENGTH) }]

            expect(signTxns(atCount).ok).toBe(true)
            expect(signTxns(atLength).ok).toBe(true)
        })

        it.each([
            [
                'too many transactions',
                Array.from(
                    { length: MAX_TRANSACTION_SIGN_REQUESTS + 1 },
                    () => ({ txn: 'AA==' }),
                ),
            ],
            [
                'a transaction over the base64 cap',
                [{ txn: 'A'.repeat(ARC0001_MAX_TXN_B64_LENGTH + 1) }],
            ],
            ['an empty array', []],
            ['bare strings instead of entries', ['AA==']],
            ['an empty txn', [{ txn: '' }]],
            ['a non-array', { txn: 'AA==' }],
        ])('refuses %s as out of bounds', (_label, txns) => {
            expect(signTxns(txns)).toEqual({
                ok: false,
                reason: 'out-of-bounds',
                message: 'Request exceeds size limits',
            })
        })

        it('reports a missing txns or data param by name', () => {
            expect(adapter.parseSigningParams('sign-transactions', {})).toEqual(
                {
                    ok: false,
                    reason: 'missing',
                    message: 'Missing required param: txns',
                },
            )
            expect(adapter.parseSigningParams('sign-data', {})).toEqual({
                ok: false,
                reason: 'missing',
                message: 'Missing required param: data',
            })
        })

        it('passes an ARC-60 wire object through whole', () => {
            const wire = {
                data: 'eyJ9',
                signer: 'A',
                metadata: { scope: 1, encoding: 'base64' },
            }

            expect(adapter.parseSigningParams('sign-data', wire)).toEqual({
                ok: true,
                payload: wire,
            })
        })

        it('unwraps a { data: [...] } request to its array', () => {
            const data = [{ data: 'eA==', signer: 'A' }]

            expect(adapter.parseSigningParams('sign-data', { data })).toEqual({
                ok: true,
                payload: data,
            })
        })
    })

    describe('resolveReportedNetwork', () => {
        it('passes a baked network through', () => {
            expect(
                adapter.resolveReportedNetwork(Networks.mainnet, undefined),
            ).toBe(Networks.mainnet)
            expect(
                adapter.resolveReportedNetwork(Networks.testnet, 'ignored'),
            ).toBe(Networks.testnet)
        })

        it('maps a custom network onto the baked network sharing its genesis hash', () => {
            const hash = getNetworkConfig(Networks.testnet).genesisHash

            expect(adapter.resolveReportedNetwork(Networks.custom, hash)).toBe(
                Networks.testnet,
            )
        })

        it('refuses a custom network whose genesis hash matches no baked network', () => {
            expect(
                adapter.resolveReportedNetwork(
                    Networks.custom,
                    'not-a-real-hash',
                ),
            ).toBeUndefined()
            expect(
                adapter.resolveReportedNetwork(Networks.custom, undefined),
            ).toBeUndefined()
            expect(
                adapter.resolveReportedNetwork(Networks.custom, ''),
            ).toBeUndefined()
        })
    })

    describe('relayableErrorNames', () => {
        // The relay matches on `error.name`, so these pins fail loudly on a
        // class rename instead of silently dropping to generic copy.
        it('names the real ARC-0001 error class', () => {
            expect(
                new Arc0001Error(Arc0001ErrorCode.InvalidInput, 'x').name,
            ).toBe('Arc0001Error')
            expect(adapter.relayableErrorNames).toContain('Arc0001Error')
        })

        it('leaves out the cancel error, which the transport relays itself', () => {
            expect(new UserCancelledError().name).toBe('UserCancelledError')
            expect(adapter.relayableErrorNames).not.toContain(
                'UserCancelledError',
            )
        })

        it('withholds errors that wrap third-party text or held addresses', () => {
            const withheld = [
                new TransportError('x').name,
                new SourceError('x').name,
                new CannotSignError('addr').name,
                new NoLocalParticipantsError('addr').name,
            ]

            expect(withheld).toEqual([
                'TransportError',
                'SourceError',
                'CannotSignError',
                'NoLocalParticipantsError',
            ])
            for (const name of withheld) {
                expect(adapter.relayableErrorNames).not.toContain(name)
            }
        })
    })
})
