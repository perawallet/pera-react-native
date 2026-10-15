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

import { beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { ChainDeeplinkIntent } from '@perawallet/wallet-core-deeplinks'
import {
    isWalletConnectFocusHint,
    parseWalletConnectUri,
} from '@perawallet/wallet-core-walletconnect'
import { setCustomNetwork } from '../../blockchain/store'
import { algorandDeeplinkAdapter as adapter } from '../adapter'

const ADDR = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const RECEIVER = 'Z73KQDNF5X3OPYUJNKH77CWZTHAYBKDUYRJELNMVFKWWYUJH2V2Y54W4CM'
const ALGORAND = 'algorand'
const WC = 'wc:test@1?bridge=test&key=test'

const intentOf = (input: string): ChainDeeplinkIntent => {
    const result = adapter.parse(input)
    if (!result.ok) throw new Error(`expected ok, got ${result.reason}`)
    return result.intent
}

const reasonOf = (input: string) => {
    const result = adapter.parse(input)
    return result.ok ? 'ok' : result.reason
}

describe('algorandDeeplinkAdapter', () => {
    beforeEach(() => {
        useNetworkStore.getState().resetState()
    })

    describe('address', () => {
        it('reads a bare address', () => {
            expect(intentOf(`algorand://${ADDR}`)).toEqual({
                kind: 'address',
                target: { chainId: ALGORAND },
                address: ADDR,
                label: undefined,
            })
        })

        it('keeps the label', () => {
            expect(intentOf(`algorand://${ADDR}?label=My%20Address`)).toEqual({
                kind: 'address',
                target: { chainId: ALGORAND },
                address: ADDR,
                label: 'My Address',
            })
        })

        it('reads type=appl as a bare address and ignores unknown keys', () => {
            expect(intentOf(`algorand://${ADDR}?type=appl&x=1`).kind).toBe(
                'address',
            )
        })

        it('drops a note that has no amount or asset', () => {
            expect(intentOf(`algorand://${ADDR}?note=hi`).kind).toBe('address')
        })

        it('reads an uppercase scheme', () => {
            expect(intentOf(`ALGORAND://${ADDR}`).kind).toBe('address')
        })

        it('tolerates a trailing slash', () => {
            expect(intentOf(`algorand://${ADDR}/`).kind).toBe('address')
        })
    })

    describe('payment', () => {
        it('reads an ALGO payment in base units with the native ref', () => {
            expect(
                intentOf(`algorand://${ADDR}?amount=1000000&label=L`),
            ).toEqual({
                kind: 'payment',
                target: { chainId: ALGORAND },
                recipient: ADDR,
                assetRef: { chainId: ALGORAND, assetId: '0' },
                amount: new Decimal(1_000_000),
                label: 'L',
                note: undefined,
                chainData: undefined,
            })
        })

        it('carries note and the unchangeable xnote separately', () => {
            expect(
                intentOf(
                    `algorand://${RECEIVER}?amount=100&note=hello&xnote=HELLO%20WORLD%20XNOTE`,
                ),
            ).toMatchObject({
                kind: 'payment',
                note: 'hello',
                chainData: { family: 'algorand', xnote: 'HELLO WORLD XNOTE' },
            })
        })

        it('reads an asset payment', () => {
            expect(
                intentOf(`algorand://${ADDR}?amount=100&asset=123456`),
            ).toMatchObject({
                kind: 'payment',
                recipient: ADDR,
                assetRef: { chainId: ALGORAND, assetId: '123456' },
                amount: new Decimal(100),
            })
        })

        it('carries an asset ref and the unchangeable xnote on one payment', () => {
            expect(
                intentOf(
                    `algorand://${RECEIVER}?amount=99999&asset=31566704&xnote=HELLO%20WORLD%20XNOTE`,
                ),
            ).toMatchObject({
                kind: 'payment',
                recipient: RECEIVER,
                amount: new Decimal(99999),
                assetRef: { chainId: ALGORAND, assetId: '31566704' },
                chainData: { family: 'algorand', xnote: 'HELLO WORLD XNOTE' },
            })
        })

        it('ignores unknown parameters', () => {
            expect(
                intentOf(`algorand://${ADDR}?unknown=param&amount=100`),
            ).toMatchObject({ kind: 'payment', amount: new Decimal(100) })
        })

        it('drops an empty value rather than reading it', () => {
            expect(intentOf(`algorand://${ADDR}?foo=`)).toMatchObject({
                kind: 'address',
                address: ADDR,
            })
        })

        it('reads an asset payment without an amount', () => {
            const intent = intentOf(`algorand://${ADDR}?asset=123456`)

            expect(intent).toMatchObject({
                kind: 'payment',
                assetRef: { assetId: '123456' },
            })
            expect('amount' in intent && intent.amount).toBeFalsy()
        })

        it('reads asset=0 with amount=0 as a 0-ALGO payment, not an opt-in', () => {
            expect(
                intentOf(`algorand://${ADDR}?asset=0&amount=0`),
            ).toMatchObject({
                kind: 'payment',
                assetRef: { assetId: '0' },
                amount: new Decimal(0),
            })
        })

        it('does not carry a network the link does not name', () => {
            const intent = intentOf(`algorand://${ADDR}?amount=1`)

            expect(
                'target' in intent && intent.target.networkId,
            ).toBeUndefined()
        })

        it('carries the network the link names', () => {
            expect(
                intentOf(`algorand://net:testnet-v1.0/${ADDR}?amount=1`),
            ).toMatchObject({
                kind: 'payment',
                target: { chainId: ALGORAND, networkId: 'testnet' },
            })
        })

        it('rejects a repeated key rather than letting the last one win', () => {
            expect(reasonOf(`algorand://${ADDR}?amount=1&amount=2`)).toBe(
                'malformed',
            )
        })

        it('rejects a non-numeric amount and a non-numeric asset', () => {
            expect(reasonOf(`algorand://${ADDR}?amount=1.5`)).toBe('malformed')
            expect(reasonOf(`algorand://${ADDR}?asset=abc`)).toBe('malformed')
            expect(reasonOf(`algorand://${ADDR}?amount=100&asset=-1`)).toBe(
                'malformed',
            )
        })

        it('rejects an undecodable query value', () => {
            expect(reasonOf(`algorand://${ADDR}?foo=%E0%A4%A`)).toBe(
                'malformed',
            )
        })

        it('rejects an address-less transfer', () => {
            expect(reasonOf('algorand://?amount=100')).toBe('malformed')
        })
    })

    describe('asset opt-in', () => {
        it('reads amount=0 with an asset', () => {
            expect(
                intentOf(`algorand://${ADDR}?amount=0&asset=123456`),
            ).toEqual({
                kind: 'asset-opt-in',
                target: { chainId: ALGORAND },
                assetRef: { chainId: ALGORAND, assetId: '123456' },
                address: ADDR,
            })
        })

        it('reads an address-less opt-in', () => {
            expect(
                intentOf('algorand://?amount=0&asset=1152109334'),
            ).toMatchObject({
                kind: 'asset-opt-in',
                assetRef: { assetId: '1152109334' },
                address: undefined,
            })
        })

        it('rejects a present-but-invalid address instead of treating it as address-less', () => {
            expect(
                reasonOf(`algorand://${ADDR.slice(0, -1)}?amount=0&asset=123`),
            ).toBe('malformed')
            expect(reasonOf('algorand://NOTANADDRESS?amount=0&asset=123')).toBe(
                'malformed',
            )
        })

        it('rejects a non-numeric or negative asset', () => {
            expect(reasonOf('algorand://?amount=0&asset=abc')).toBe('malformed')
            expect(reasonOf('algorand://?amount=0&asset=-1')).toBe('malformed')
        })
    })

    describe('keyreg', () => {
        const keyreg = (query: string, path = ADDR) =>
            intentOf(`algorand://${path}?type=keyreg${query}`)

        it('reads the participation keys, rounds and fee', () => {
            expect(
                keyreg(
                    '&votekey=voteKey123&selkey=selKey123&sprfkey=sprf1&votefst=1000&votelst=2000&votekd=100&fee=1000&note=n&xnote=x',
                ),
            ).toEqual({
                kind: 'chain-action',
                target: { chainId: ALGORAND },
                chainData: {
                    family: 'algorand',
                    action: 'keyreg',
                    sender: ADDR,
                    keyregType: 'online',
                    voteKey: 'voteKey123',
                    selectionKey: 'selKey123',
                    stateProofKey: 'sprf1',
                    voteFirst: '1000',
                    voteLast: '2000',
                    voteKeyDilution: '100',
                    fee: new Decimal(1000),
                    note: 'n',
                    xnote: 'x',
                },
            })
        })

        it('falls back to the legacy votekdkey spelling', () => {
            expect(keyreg('&votekdkey=100')).toMatchObject({
                chainData: { voteKeyDilution: '100' },
            })
        })

        it('keeps URL-safe unpadded keys verbatim', () => {
            const intent = intentOf(
                `algorand://${ADDR}?type=keyreg&selkey=-lfw-Y04lTnllJfncgMjXuAePe8i8YyVeoR9c1Xi78c&sprfkey=3NoXc2sEWlvQZ7XIrwVJjgjM30ndhvwGgcqwKugk1u5W_iy_JITXrykuy0hUvAxbVv0njOgBPtGFsFif3yLJpg&votefst=1300&votekd=100&votekey=UU8zLMrFVfZPnzbnL6ThAArXFsznV3TvFVAun2ONcEI&votelst=11300&fee=2000000&note=Consensus%2Bparticipation%2Bftw`,
            )

            expect(intent).toMatchObject({
                kind: 'chain-action',
                chainData: {
                    keyregType: 'online',
                    selectionKey: '-lfw-Y04lTnllJfncgMjXuAePe8i8YyVeoR9c1Xi78c',
                    voteFirst: '1300',
                    fee: new Decimal(2_000_000),
                    note: 'Consensus+participation+ftw',
                },
            })
        })

        it('reads a bare type=keyreg as the offline de-registration', () => {
            expect(keyreg('')).toMatchObject({
                chainData: { keyregType: 'offline', sender: ADDR },
            })
        })

        it('treats a partial key set as online, not offline', () => {
            expect(keyreg('&votekey=voteKey123')).toMatchObject({
                chainData: { keyregType: 'online' },
            })
        })

        it('tolerates a trailing slash after the sender', () => {
            expect(intentOf(`algorand://${ADDR}/?type=keyreg`)).toMatchObject({
                chainData: { sender: ADDR },
            })
        })

        it('rejects a keyreg with no sender', () => {
            expect(reasonOf('algorand://?type=keyreg')).toBe('malformed')
        })

        it('rejects an invalid sender', () => {
            expect(reasonOf('algorand://INVALID_ADDRESS?type=keyreg')).toBe(
                'malformed',
            )
        })

        it.each(['fee', 'votefst', 'votelst', 'votekd'])(
            'rejects a non-numeric %s',
            key => {
                expect(
                    reasonOf(`algorand://${ADDR}?type=keyreg&${key}=x`),
                ).toBe('malformed')
            },
        )

        // A raw genesis id is not a network id, so the link resolves to `testnet`.
        it('names the network by genesis id, resolved to a network id', () => {
            expect(
                intentOf(`algorand://net:testnet-v1.0/${ADDR}?type=keyreg`),
            ).toMatchObject({
                target: { chainId: ALGORAND, networkId: 'testnet' },
            })
        })

        it('leaves the network unset when the URI names none', () => {
            const intent = keyreg('')

            expect(
                'target' in intent && intent.target.networkId,
            ).toBeUndefined()
        })
    })

    describe('explorer', () => {
        it('opens the MainNet explorer for an asset', () => {
            expect(intentOf('algorand://asset/123456')).toEqual({
                kind: 'explorer',
                target: { chainId: ALGORAND },
                url: 'https://explorer.perawallet.app/asset/123456/',
            })
        })

        it('opens the MainNet explorer for an application', () => {
            expect(intentOf('algorand://app/7890')).toMatchObject({
                url: 'https://explorer.perawallet.app/application/7890/',
            })
        })

        it('resolves the bare testnet name', () => {
            expect(
                intentOf('algorand://net:testnet/asset/123456'),
            ).toMatchObject({
                url: 'https://testnet.explorer.perawallet.app/asset/123456/',
            })
            expect(intentOf('algorand://net:testnet/app/7890')).toMatchObject({
                url: 'https://testnet.explorer.perawallet.app/application/7890/',
            })
        })

        // The genesis id is the ARC-90 spelling, so it must resolve like the bare name.
        it('opens the TestNet explorer for the testnet genesis id', () => {
            expect(
                intentOf('algorand://net:testnet-v1.0/asset/1'),
            ).toMatchObject({
                target: { chainId: ALGORAND, networkId: 'testnet' },
                url: 'https://testnet.explorer.perawallet.app/asset/1/',
            })
        })

        it('drops an empty query value', () => {
            expect(intentOf('algorand://app/123?foo=').kind).toBe('explorer')
            expect(intentOf('algorand://asset/123?foo=').kind).toBe('explorer')
        })

        it('ignores the query', () => {
            expect(intentOf('algorand://asset/123?foo=bar').kind).toBe(
                'explorer',
            )
            expect(intentOf('algorand://app/123?foo=%zz').kind).toBe('explorer')
        })

        it.each([
            'algorand://app/abc',
            'algorand://asset/abc',
            'algorand://asset/opt-in',
            'algorand://asset/1/2',
            'algorand://discover',
            'algorand://cards',
            'algorand://staking',
            'algorand://INVALID_ADDRESS',
        ])('rejects %s', input => {
            expect(reasonOf(input)).toBe('malformed')
        })
    })

    describe('network', () => {
        it('rejects an unknown genesis id', () => {
            expect(reasonOf(`algorand://net:foonet-v1.0/${ADDR}`)).toBe(
                'unsupported-network',
            )
        })

        // A hash that names no known network must never fall back to MainNet or pass through raw.
        it('rejects an unknown genesis hash', () => {
            expect(reasonOf(`algorand://gh:AAAA/${ADDR}`)).toBe(
                'unsupported-network',
            )
            expect(reasonOf('algorand://gh:myrepo/asset/123')).toBe(
                'unsupported-network',
            )
            expect(
                reasonOf(`algorand://gh:abcDEF123-_xyz/${ADDR}?type=keyreg`),
            ).toBe('unsupported-network')
        })

        it('refuses a standard-base64 hash whose slash is unescaped', () => {
            expect(
                reasonOf(
                    `algorand://gh:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=/${ADDR}?type=keyreg`,
                ),
            ).toBe('unsupported-network')
        })

        it.each([
            [
                'MainNet padded',
                'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
                'mainnet',
            ],
            [
                'TestNet base64url',
                'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9_cOUJOiI',
                'testnet',
            ],
            [
                'TestNet percent-encoded',
                'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9%2FcOUJOiI%3D',
                'testnet',
            ],
        ])('resolves a gh: hash: %s', (_name, hash, networkId) => {
            expect(
                intentOf(`algorand://gh:${hash}/${ADDR}?amount=1`),
            ).toMatchObject({ target: { networkId } })
        })

        it('rejects a gh: hash with a bad escape', () => {
            expect(reasonOf(`algorand://gh:%E0%A4%A/${ADDR}`)).toBe(
                'unsupported-network',
            )
        })

        it('never matches an empty hash against an unconfigured custom node', () => {
            expect(reasonOf(`algorand://gh:/${ADDR}?type=keyreg`)).toBe(
                'unsupported-network',
            )
            expect(reasonOf(`algorand://net:/${ADDR}?type=keyreg`)).toBe(
                'unsupported-network',
            )
        })

        describe('with a saved custom node', () => {
            beforeEach(() => {
                setCustomNetwork({
                    algodUrl: 'http://10.0.0.5:4001',
                    indexerUrl: 'http://10.0.0.5:8980',
                    genesisId: 'dockernet-v1',
                    genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
                })
            })

            it('resolves its genesis id and hash to the custom network', () => {
                expect(
                    intentOf(`algorand://net:dockernet-v1/${ADDR}?type=keyreg`),
                ).toMatchObject({ target: { networkId: 'custom' } })
                expect(
                    intentOf(
                        `algorand://gh:MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw%3D/${ADDR}?type=keyreg`,
                    ),
                ).toMatchObject({ target: { networkId: 'custom' } })
            })

            it('has no explorer, so a link to one is unsupported', () => {
                expect(reasonOf('algorand://net:dockernet-v1/asset/1')).toBe(
                    'unsupported-network',
                )
            })
        })

        it('does not resolve a custom genesis id when none is saved', () => {
            expect(
                reasonOf(`algorand://net:dockernet-v1/${ADDR}?type=keyreg`),
            ).toBe('unsupported-network')
        })
    })

    describe('algo: (Coinbase)', () => {
        it('reads a bare address', () => {
            expect(intentOf(`algo:${ADDR}`)).toEqual({
                kind: 'address',
                target: { chainId: ALGORAND },
                address: ADDR,
            })
        })

        it('reads an asset transfer with no amount', () => {
            expect(intentOf(`algo:31566704/transfer?address=${ADDR}`)).toEqual({
                kind: 'payment',
                target: { chainId: ALGORAND },
                recipient: ADDR,
                assetRef: { chainId: ALGORAND, assetId: '31566704' },
            })
        })

        it('trims stray spaces around the receiver', () => {
            expect(
                intentOf(`algo:31566704/transfer?address=%20${ADDR}%20`),
            ).toMatchObject({ recipient: ADDR })
        })

        it('is not claimed for another scheme', () => {
            expect(reasonOf('perawallet://test')).toBe('malformed')
        })

        it('rejects an action other than transfer', () => {
            expect(reasonOf('algo:123/invalid?address=test')).toBe(
                'unsupported-action',
            )
        })

        it.each([
            'algo:123/transfer',
            'algo:123',
            `algo:31566704/transfer?address=${ADDR.slice(0, 57)}`,
            `algo:abc/transfer?address=${ADDR}`,
            `algo:${ADDR}?x=%zz`,
        ])('rejects %s', input => {
            expect(reasonOf(input)).toBe('malformed')
        })
    })

    describe('WalletConnect wrappers', () => {
        const wrapped = encodeURIComponent(WC)
        const pairing = (uri: string) => {
            const intent = intentOf(uri)
            if (intent.kind !== 'wallet-connect') {
                throw new Error(`expected wallet-connect, got ${intent.kind}`)
            }
            return intent.uri
        }

        it('swaps the algorand-wc scheme for wc', () => {
            expect(pairing(`algorand-wc:${WC.slice(3)}`)).toBe(WC)
        })

        // The WalletConnect layer must read the intent exactly as it read the original.
        it.each([
            ['algorand://wc?uri=', undefined],
            ['algorand://wc?uri=', 'chrome'],
            ['algorand-wc://wc?uri=', undefined],
        ])(
            'unwraps %s with browser %s the same as the original link',
            (prefix, browserName) => {
                const link = `${prefix}${wrapped}${browserName ? `&browser=${browserName}` : ''}`

                expect(parseWalletConnectUri(pairing(link))).toEqual({
                    uri: WC,
                    browserName,
                })
                expect(parseWalletConnectUri(pairing(link))).toEqual(
                    parseWalletConnectUri(link),
                )
            },
        )

        it('keeps the focus hint a focus hint', () => {
            const uri = pairing('algorand://wc?browser=chrome')

            expect(parseWalletConnectUri(uri)).toBeNull()
            expect(isWalletConnectFocusHint(uri)).toBe(true)
        })

        it('reads algorand://wc without a query as malformed ARC-90', () => {
            expect(reasonOf('algorand://wc')).toBe('malformed')
        })
    })

    describe('toAssetRef', () => {
        it('maps digits to an Algorand asset ref', () => {
            expect(adapter.toAssetRef('31566704')).toEqual({
                chainId: ALGORAND,
                assetId: '31566704',
            })
        })

        it('canonicalises leading zeros', () => {
            expect(adapter.toAssetRef('007')?.assetId).toBe('7')
        })

        it.each(['-1', 'abc', ''])('refuses %j', raw => {
            expect(adapter.toAssetRef(raw)).toBeUndefined()
        })
    })
})
