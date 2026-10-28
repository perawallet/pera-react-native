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

// @vitest-environment node

// @vitest-environment node

import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import {
    DeeplinkType,
    deeplinkAdapters,
} from '@perawallet/wallet-core-deeplinks'
import { algorandAddressCodec } from '@packages/chain-algorand/src/accounts/address-codec'
import { registerDeeplinkAdapters } from '@test-utils/deeplink-adapters'
import { afterEach, beforeEach } from 'vitest'
import { parseDeeplink } from '../parser'

const TEST_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

beforeEach(() => {
    addressCodecs.register(algorandAddressCodec)
    registerDeeplinkAdapters()
})

afterEach(() => {
    addressCodecs.reset()
    deeplinkAdapters.reset()
})

describe('ARC-90 links through the Algorand adapter', () => {
    describe('Address Actions (Basic Scan)', () => {
        it('parses simple address', () => {
            const result = parseDeeplink(`algorand://${TEST_ADDRESS}`)
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
            if (result?.type === DeeplinkType.ADDRESS_ACTIONS) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })

        it('parses address with label', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?label=My%20Address`,
            )
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
            if (result?.type === DeeplinkType.ADDRESS_ACTIONS) {
                expect(result.address).toBe(TEST_ADDRESS)
                expect(result.label).toBe('My Address')
            }
        })
    })

    describe('Native-asset transfer', () => {
        it('parses ALGO transfer with amount', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?amount=1000000`,
            )
            expect(result?.type).toBe(DeeplinkType.TRANSFER)
            if (result?.type === DeeplinkType.TRANSFER) {
                expect(result.receiverAddress).toBe(TEST_ADDRESS)
                expect(result.amount?.toFixed()).toBe('1000000')
                expect(result.assetRef?.assetId).toBe('0')
            }
        })

        it('parses ALGO transfer with note and xnote', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?amount=100&note=hello&xnote=secret`,
            )
            expect(result?.type).toBe(DeeplinkType.TRANSFER)
            if (result?.type === DeeplinkType.TRANSFER) {
                expect(result.note).toBe('hello')
                expect(result.chainData).toMatchObject({ xnote: 'secret' })
            }
        })
    })

    describe('Asset Transfer', () => {
        it('parses asset transfer with amount', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?amount=100&asset=123456`,
            )
            expect(result?.type).toBe(DeeplinkType.TRANSFER)
            if (result?.type === DeeplinkType.TRANSFER) {
                expect(result.assetRef?.assetId).toBe('123456')
                expect(result.amount?.toFixed()).toBe('100')
                expect(result.receiverAddress).toBe(TEST_ADDRESS)
            }
        })

        it('parses asset transfer without amount (optional in ARC-90)', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?asset=123456`,
            )
            expect(result?.type).toBe(DeeplinkType.TRANSFER)
            if (result?.type === DeeplinkType.TRANSFER) {
                expect(result.assetRef?.assetId).toBe('123456')
                expect(result.amount).toBeUndefined()
            }
        })
    })

    describe('Asset Opt-in', () => {
        it('parses asset opt-in (0 amount self-transfer)', () => {
            // Note: In ARC-90, opt-in isn't a distinct type, but conventionally handled
            // as a 0 amount transfer of the asset.
            // Our parser explicitly detects this combination.
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?amount=0&asset=123456`,
            )
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.assetRef.assetId).toBe('123456')
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })

        it('parses an address-less opt-in (algorand://?amount=0&asset=…)', () => {
            // The real reported QR — no receiver, account picked downstream.
            const result = parseDeeplink(
                'algorand://?amount=0&asset=1152109334',
            )
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.assetRef.assetId).toBe('1152109334')
                expect(result.address).toBeUndefined()
            }
        })

        it('rejects a present-but-malformed address (corruption ≠ address-less)', () => {
            // A truncated/misread QR carries an invalid address — distinct from
            // a legitimately address-less opt-in. Reject it (→ "unrecognized")
            // rather than silently opting a different account in.
            const truncated = TEST_ADDRESS.slice(0, -1)
            expect(
                parseDeeplink(`algorand://${truncated}?amount=0&asset=123`),
            ).toBeNull()
            expect(
                parseDeeplink('algorand://NOTANADDRESS?amount=0&asset=123'),
            ).toBeNull()
        })

        it('keeps the address on an opt-in that carries one', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?amount=0&asset=999`,
            )
            expect(result?.type).toBe(DeeplinkType.ASSET_OPT_IN)
            if (result?.type === DeeplinkType.ASSET_OPT_IN) {
                expect(result.address).toBe(TEST_ADDRESS)
            }
        })

        it('still rejects an address-less transfer (no asset, non-zero amount)', () => {
            expect(parseDeeplink('algorand://?amount=100')).toBeNull()
        })
    })

    describe('Non-numeric asset id (ARC-90: assetid = 1*DIGIT)', () => {
        it('rejects a non-numeric asset id on an opt-in', () => {
            expect(parseDeeplink('algorand://?amount=0&asset=abc')).toBeNull()
        })

        it('rejects a negative asset id on an opt-in', () => {
            expect(parseDeeplink('algorand://?amount=0&asset=-1')).toBeNull()
        })

        it('rejects a non-numeric asset id on a transfer', () => {
            expect(
                parseDeeplink(`algorand://${TEST_ADDRESS}?asset=abc`),
            ).toBeNull()
            expect(
                parseDeeplink(`algorand://${TEST_ADDRESS}?amount=100&asset=-1`),
            ).toBeNull()
        })
    })

    describe('Keyreg', () => {
        it('parses keyreg transaction (ARC-26 votekd field)', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?type=keyreg&votekey=voteKey123&selkey=selKey123&votefst=1000&votelst=2000&votekd=100&fee=1000`,
            )
            expect(result?.type).toBe(DeeplinkType.CHAIN_ACTION)
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.sender).toBe(TEST_ADDRESS)
                expect(result.chainData.voteKey).toBe('voteKey123')
                expect(result.chainData.selectionKey).toBe('selKey123')
                expect(result.chainData.voteFirst).toBe('1000')
                expect(result.chainData.voteLast).toBe('2000')
                expect(result.chainData.voteKeyDilution).toBe('100')
                expect(result.chainData.fee?.toFixed()).toBe('1000')
            }
        })

        it('falls back to legacy votekdkey field for backwards compat', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?type=keyreg&votekey=voteKey123&selkey=selKey123&votefst=1000&votelst=2000&votekdkey=100`,
            )
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.voteKeyDilution).toBe('100')
            }
        })

        it('marks a keyreg carrying participation keys as online', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?type=keyreg&votekey=voteKey123&selkey=selKey123&sprfkey=sprfKey123&votefst=1000&votelst=2000&votekd=100`,
            )
            expect(result?.type).toBe(DeeplinkType.CHAIN_ACTION)
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.keyregType).toBe('online')
            }
        })

        // ARC-78 has no online/offline discriminator: the smallest valid URI
        // (`?type=keyreg` alone) IS the de-registration, and nodekit emits
        // exactly that when a node runner goes offline.
        it('marks a keyreg with no participation keys as offline', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?type=keyreg`,
            )
            expect(result?.type).toBe(DeeplinkType.CHAIN_ACTION)
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.keyregType).toBe('offline')
            }
        })

        // RFC 3986 allows an empty final path segment, and Pera's own
        // app-action links are written that way. Left on the address it fails
        // validation, the whole URI parses to null, and the QR scanner
        // silently re-arms with no feedback at all.
        it('tolerates a trailing slash after the sender address', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}/?type=keyreg`,
            )
            expect(result?.type).toBe(DeeplinkType.CHAIN_ACTION)
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.sender).toBe(TEST_ADDRESS)
                expect(result.chainData.keyregType).toBe('offline')
            }
        })

        // ARC-90 `net:`/`gh:` names the chain the keyreg is for. Dropped, a
        // testnet QR scanned on mainnet silently built a MAINNET keyreg —
        // and the genesis-hash analyzer cannot catch it, because the txn is
        // built with the active network's hash and so always matches.
        it('carries the net: genesis id through as the target network', () => {
            const result = parseDeeplink(
                `algorand://net:testnet-v1.0/${TEST_ADDRESS}?type=keyreg`,
            )
            expect(result?.type).toBe(DeeplinkType.CHAIN_ACTION)
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.sender).toBe(TEST_ADDRESS)
                expect(result.target.networkId).toBe('testnet')
            }
        })

        // A genesis hash the wallet does not know names no network it can
        // build for, so the link is refused rather than built on the active one.
        it('returns null for a gh: genesis hash no network has', () => {
            expect(
                parseDeeplink(
                    `algorand://gh:abcDEF123-_xyz/${TEST_ADDRESS}?type=keyreg`,
                ),
            ).toBeNull()
        })

        // A standard-base64 genesis hash contains `/`, and the network prefix
        // is split on the FIRST `/` — so such a URI cannot be parsed. It fails
        // closed (address ends up malformed → whole URI rejected) rather than
        // dropping the qualifier and building against the active chain, which
        // is the safe direction. Pinned so it stays that way; carrying `gh:`
        // properly means percent-encoding or base64url in the emitter.
        it('rejects a gh: hash containing a slash rather than mis-parsing it', () => {
            expect(
                parseDeeplink(
                    `algorand://gh:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=/${TEST_ADDRESS}?type=keyreg`,
                ),
            ).toBeNull()
        })

        it('leaves the target network unset when the URI names none', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?type=keyreg`,
            )
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.target.networkId).toBeUndefined()
            }
        })

        // A partial key set must NOT read as a de-registration: the user
        // scanned a go-online QR, and silently signing an offline keyreg
        // instead would take their node out of consensus.
        it('treats a partial participation key set as online, not offline', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?type=keyreg&votekey=voteKey123`,
            )
            expect(result?.type).toBe(DeeplinkType.CHAIN_ACTION)
            if (result?.type === DeeplinkType.CHAIN_ACTION) {
                expect(result.chainData.keyregType).toBe('online')
            }
        })
    })

    describe('Asset Query', () => {
        it('parses asset query to Discover Browser (Explorer)', () => {
            const result = parseDeeplink('algorand://asset/123456')
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://explorer.perawallet.app/asset/123456/',
                )
            }
        })

        it('parses asset query with testnet to Discover Browser (Testnet Explorer)', () => {
            const result = parseDeeplink('algorand://net:testnet/asset/123456')
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://testnet.explorer.perawallet.app/asset/123456/',
                )
            }
        })
    })

    describe('App Query', () => {
        it('parses app query to Discover Browser (Explorer)', () => {
            const result = parseDeeplink('algorand://app/7890')
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://explorer.perawallet.app/application/7890/',
                )
            }
        })

        it('parses app query with testnet to Discover Browser (Testnet Explorer)', () => {
            const result = parseDeeplink('algorand://net:testnet/app/7890')
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
            if (result?.type === DeeplinkType.DISCOVER_BROWSER) {
                expect(result.url).toBe(
                    'https://testnet.explorer.perawallet.app/application/7890/',
                )
            }
        })

        it('parses app query with query params', () => {
            const result = parseDeeplink('algorand://app/7890?foo=bar')
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
        })
    })

    describe('Validation & Edge Cases', () => {
        it('returns null for invalid scheme', () => {
            expect(parseDeeplink(`http://${TEST_ADDRESS}`)).toBeNull()
        })

        it('returns null for invalid address', () => {
            expect(parseDeeplink('algorand://INVALID_ADDRESS')).toBeNull()
        })

        it('returns null for invalid keyreg address', () => {
            expect(
                parseDeeplink('algorand://INVALID_ADDRESS?type=keyreg'),
            ).toBeNull()
        })

        it('returns null for an asset link whose gh: genesis hash no network has', () => {
            expect(parseDeeplink('algorand://gh:myrepo/asset/123')).toBeNull()
        })

        it('parses asset query with query params', () => {
            const result = parseDeeplink('algorand://asset/123?foo=bar')
            expect(result?.type).toBe(DeeplinkType.DISCOVER_BROWSER)
        })

        it('returns null for missing address', () => {
            expect(parseDeeplink('algorand://?amount=100')).toBeNull()
        })

        it('returns null for non-compliant paths (custom Pera paths)', () => {
            // These should NO LONGER be handled by the ARC-90 parser
            expect(parseDeeplink('algorand://discover')).toBeNull()
            expect(parseDeeplink('algorand://cards')).toBeNull()
            expect(parseDeeplink('algorand://staking')).toBeNull()
            expect(parseDeeplink('algorand://asset/opt-in')).toBeNull() // Old path style
        })

        it('ignores unknown parameters', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?unknown=param&amount=100`,
            )
            expect(result?.type).toBe(DeeplinkType.TRANSFER)
            // Should still parse valid params
            if (result?.type === DeeplinkType.TRANSFER) {
                expect(result.amount?.toFixed()).toBe('100')
            }
        })

        it('parses type=appl as ADDRESS_ACTIONS (noop in ARC-90)', () => {
            const result = parseDeeplink(`algorand://${TEST_ADDRESS}?type=appl`)
            expect(result?.type).toBe(DeeplinkType.ADDRESS_ACTIONS)
        })

        it('returns null for malformed query params (decodeURIComponent failure)', () => {
            const result = parseDeeplink(
                `algorand://${TEST_ADDRESS}?foo=%E0%A4%A`,
            )
            expect(result).toBeNull()
        })

        it('returns null for invalid appId in ARC-90', () => {
            expect(parseDeeplink('algorand://app/abc')).toBeNull()
        })

        it('returns null for invalid assetId in ARC-90', () => {
            expect(parseDeeplink('algorand://asset/abc')).toBeNull()
        })

        it('handles empty parameter values in ARC-90', () => {
            const result1 = parseDeeplink('algorand://app/123?foo=')
            expect(result1).not.toBeNull()

            const result2 = parseDeeplink('algorand://asset/123?foo=')
            expect(result2).not.toBeNull()

            const result3 = parseDeeplink(`algorand://${TEST_ADDRESS}?foo=`)
            expect(result3).not.toBeNull()
        })
    })
})
