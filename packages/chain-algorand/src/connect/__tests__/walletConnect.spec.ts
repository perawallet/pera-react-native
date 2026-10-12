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
import { Networks } from '@perawallet/wallet-core-config'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing/constants'
import {
    ALGORAND_WC_V2_METHOD,
    algorandWalletConnectSupport as support,
    createAlgorandWalletConnectV2Support,
    toCaip2ChainId,
} from '../walletConnect'

// The registered ids from the Chain Agnostic `algorand` namespace. Hard-coded
// on purpose: the adapter derives them from config's genesis hashes, so
// comparing against the published values catches a typo on either side.
const MAINNET_CHAIN_ID = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
const TESTNET_CHAIN_ID = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
const BETANET_CHAIN_ID = 'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2'

// v1's numeric ids (mirrored from walletconnect's own `AlgorandWalletConnectChainId`).
const V1_ALL = 4160
const V1_MAINNET = 416_001
const V1_TESTNET = 416_002
const V1_BETANET = 416_003

describe('namespace', () => {
    it('is the registered algorand CAIP-2 namespace', () => {
        expect(support.namespace).toBe('algorand')
    })
})

describe('toCaip2ChainId', () => {
    it('has no id for a genesis hash shorter than the CAIP-2 reference', () => {
        // A blanked env override reaches here as an empty or truncated hash; a
        // bare `algorand:` prefix would match no chain any dApp presents.
        expect(toCaip2ChainId('')).toBeNull()
        expect(toCaip2ChainId('wGHE2Pwdvd7S12BL5FaOP2')).toBeNull()
    })

    it('accepts a hash exactly the reference length', () => {
        expect(toCaip2ChainId('wGHE2Pwdvd7S12BL5FaOP20EGYesN73k')).toBe(
            MAINNET_CHAIN_ID,
        )
    })

    it('uses the URL-safe alphabet', () => {
        expect(toCaip2ChainId('mFgazF+2uRS1tMiL9dsj01hJGySEmPN2yFs=')).toBe(
            BETANET_CHAIN_ID,
        )
    })
})

describe('caip2ChainIdFor / networkForCaip2ChainId', () => {
    it('derives mainnet, testnet and betanet ids and round-trips them', () => {
        expect(support.caip2ChainIdFor('mainnet')).toBe(MAINNET_CHAIN_ID)
        expect(support.caip2ChainIdFor('testnet')).toBe(TESTNET_CHAIN_ID)
        expect(support.caip2ChainIdFor('betanet')).toBe(BETANET_CHAIN_ID)

        expect(support.networkForCaip2ChainId(MAINNET_CHAIN_ID)).toBe('mainnet')
        expect(support.networkForCaip2ChainId(TESTNET_CHAIN_ID)).toBe('testnet')
        expect(support.networkForCaip2ChainId(BETANET_CHAIN_ID)).toBe('betanet')
    })

    it("encodes betanet's genesis hash with the URL-safe alphabet", () => {
        // BetaNet's base64 genesis hash contains `+` within the first 32
        // characters; plain base64 would produce an id no dApp presents.
        expect(support.caip2ChainIdFor('betanet')).toContain('mFgazF-2')
    })

    it('has no chain id for custom', () => {
        expect(support.caip2ChainIdFor('custom')).toBeNull()
    })

    it('has no chain id for a network no chain declares', () => {
        expect(support.caip2ChainIdFor('fnet')).toBeNull()
    })

    it('refuses an unknown chain id, including a foreign namespace', () => {
        expect(
            support.networkForCaip2ChainId('algorand:notAChainAtAll'),
        ).toBeNull()
        expect(support.networkForCaip2ChainId('eip155:1')).toBeNull()
        expect(support.networkForCaip2ChainId('')).toBeNull()
    })
})

describe('v1', () => {
    const v1 = support.v1
    if (!v1) throw new Error('algorandWalletConnectSupport declares no v1')

    describe('isChainIdAcceptable', () => {
        it('accepts each network only its own explicit id', () => {
            expect(v1.isChainIdAcceptable(V1_MAINNET, 'mainnet')).toBe(true)
            expect(v1.isChainIdAcceptable(V1_TESTNET, 'testnet')).toBe(true)
            expect(v1.isChainIdAcceptable(V1_BETANET, 'betanet')).toBe(true)
            expect(v1.isChainIdAcceptable(V1_MAINNET, 'testnet')).toBe(false)
        })

        it('accepts the 4160 wildcard on every network', () => {
            for (const network of Object.values(Networks)) {
                expect(v1.isChainIdAcceptable(V1_ALL, network)).toBe(true)
            }
        })

        it("lets custom borrow testnet's id", () => {
            expect(v1.isChainIdAcceptable(V1_TESTNET, 'custom')).toBe(true)
            expect(v1.isChainIdAcceptable(V1_MAINNET, 'custom')).toBe(false)
        })

        it('rejects a missing chain id', () => {
            expect(v1.isChainIdAcceptable(undefined, 'mainnet')).toBe(false)
        })
    })

    describe('networksFor', () => {
        it('expands the wildcard to every network', () => {
            expect([...v1.networksFor(V1_ALL)].sort()).toEqual(
                [...Object.values(Networks)].sort(),
            )
        })

        it("names only testnet and custom for testnet's explicit id", () => {
            expect([...v1.networksFor(V1_TESTNET)].sort()).toEqual([
                'custom',
                'testnet',
            ])
        })
    })

    describe('screenRequest — sign-transactions', () => {
        const screen = (params: unknown, knownAddresses: string[] = []) =>
            v1.screenRequest('sign-transactions', params, knownAddresses)

        it('rejects an empty or non-array group', () => {
            expect(screen([])).toEqual({
                ok: false,
                reason: 'empty or non-array transaction list',
            })
            expect(screen({ not: 'an array' })).toEqual({
                ok: false,
                reason: 'empty or non-array transaction list',
            })
        })

        it('rejects too many transactions', () => {
            const group = Array.from(
                { length: MAX_TRANSACTION_SIGN_REQUESTS + 1 },
                () => ({ txn: 'AA==' }),
            )

            expect(screen(group)).toEqual({
                ok: false,
                reason: 'too many transactions in one request',
            })
        })

        it('rejects an entry with no txn string', () => {
            expect(screen([{ message: 'hi' }])).toEqual({
                ok: false,
                reason: 'transaction entry without a txn string',
            })
        })

        it('rejects a group naming only foreign signers', () => {
            expect(
                screen([{ txn: 'AA==', signers: ['FOREIGN'] }], ['OURS']),
            ).toEqual({
                ok: false,
                reason: 'no named signer belongs to this wallet',
            })
        })

        it('accepts a group naming at least one of our signers', () => {
            expect(
                screen(
                    [{ txn: 'AA==', signers: ['FOREIGN', 'OURS'] }],
                    ['OURS'],
                ),
            ).toEqual({ ok: true })
        })

        it('accepts a group naming no signers at all', () => {
            expect(screen([{ txn: 'AA==' }])).toEqual({ ok: true })
        })
    })

    describe('screenRequest — sign-data', () => {
        const screen = (params: unknown) =>
            v1.screenRequest('sign-data', params, [])

        it('rejects a payload over the ARC-60 size cap', () => {
            const result = screen({
                data: 'A'.repeat(100_000),
                signer: 'A'.repeat(58),
                domain: 'perawallet.app',
                authenticatorData: 'AAAA',
                metadata: { scope: 1, encoding: 'base64' },
            })

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.reason).toMatch(
                    /^Invalid ARC-60 sign request payload — /,
                )
            }
        })

        it('rejects a payload failing the ARC-60 schema', () => {
            expect(
                screen({
                    data: 'ZGF0YQ==',
                    signer: 'A'.repeat(58),
                    // domain/authenticatorData/metadata omitted
                }),
            ).toEqual({ ok: false, reason: 'ARC-60 payload failed schema' })
        })
    })
})

describe('toWireResult', () => {
    it('passes the slot-ordered signed array through for sign-transactions', () => {
        expect(
            support.toWireResult({
                type: 'sign-transactions',
                signed: ['c2ln', null],
            }),
        ).toEqual(['c2ln', null])
    })

    it('base64-encodes each signature for sign-data', () => {
        expect(
            support.toWireResult({
                type: 'sign-data',
                signatures: [new Uint8Array([1, 2, 3])],
            }),
        ).toEqual(['AQID'])
    })
})

describe('createAlgorandWalletConnectV2Support', () => {
    const ADDRESS = 'A'.repeat(58)
    const makeV2 = () => {
        const emptySignaturesFor = vi.fn(() => ({ [ADDRESS]: 'gA==' }))
        return {
            v2: createAlgorandWalletConnectV2Support(emptySignaturesFor),
            emptySignaturesFor,
        }
    }
    const answerFor = (params: unknown, networkId: string) => {
        const { v2, emptySignaturesFor } = makeV2()
        const route = v2.handleRequest(
            ALGORAND_WC_V2_METHOD.getEmptySignatures,
            params,
        )
        if (route.kind !== 'public-data') throw new Error('not public data')
        return {
            answer: route.answer([ADDRESS], networkId),
            emptySignaturesFor,
        }
    }

    it('declares its methods in the order an approved namespace lists them', () => {
        const { v2 } = makeV2()

        expect(v2.methods).toEqual([
            'algo_signTxn',
            'algo_signData',
            'algo_getEmptySignatures',
        ])
        expect(v2.signingMethods).toEqual(['algo_signTxn', 'algo_signData'])
    })

    it('takes the transaction group out of the first positional slot', () => {
        const group = [{ txn: 'AA==' }]

        expect(
            makeV2().v2.handleRequest(ALGORAND_WC_V2_METHOD.signTransactions, [
                group,
                { message: 'opts' },
            ]),
        ).toEqual({
            kind: 'operation',
            type: 'sign-transactions',
            params: group,
        })
    })

    it('passes a non-array transaction param through as it arrived', () => {
        const params = { txns: [] }

        expect(
            makeV2().v2.handleRequest(
                ALGORAND_WC_V2_METHOD.signTransactions,
                params,
            ),
        ).toEqual({ kind: 'operation', type: 'sign-transactions', params })
    })

    it('passes sign-data params through unchanged', () => {
        const params = { data: 'AA==', signer: 'A' }

        expect(
            makeV2().v2.handleRequest(ALGORAND_WC_V2_METHOD.signData, params),
        ).toEqual({ kind: 'operation', type: 'sign-data', params })
    })

    it('does not serve algo_getAccounts', () => {
        expect(makeV2().v2.handleRequest('algo_getAccounts', [])).toEqual({
            kind: 'unsupported',
        })
    })

    it('answers empty signatures for a request naming no chain', () => {
        const { answer, emptySignaturesFor } = answerFor({}, Networks.mainnet)

        expect(answer).toEqual({ [ADDRESS]: 'gA==' })
        expect(emptySignaturesFor).toHaveBeenCalledWith([ADDRESS])
    })

    it("answers a request naming the network's own chain, bare or array-wrapped", () => {
        expect(
            answerFor({ chainId: MAINNET_CHAIN_ID }, Networks.mainnet).answer,
        ).toEqual({ [ADDRESS]: 'gA==' })
        expect(
            answerFor([{ chainId: MAINNET_CHAIN_ID }], Networks.mainnet).answer,
        ).toEqual({ [ADDRESS]: 'gA==' })
    })

    it('refuses a request naming another network without building signatures', () => {
        const { answer, emptySignaturesFor } = answerFor(
            { chainId: TESTNET_CHAIN_ID },
            Networks.mainnet,
        )

        expect(answer).toBeNull()
        expect(emptySignaturesFor).not.toHaveBeenCalled()
    })

    it('refuses any named chain on a custom network, which has no CAIP-2 id', () => {
        expect(
            answerFor({ chainId: MAINNET_CHAIN_ID }, Networks.custom).answer,
        ).toBeNull()
    })
})
