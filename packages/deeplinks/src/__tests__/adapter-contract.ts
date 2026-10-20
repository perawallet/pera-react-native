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

// The suite chain packages run against their own deeplink adapter; aliased
// as `@perawallet/wallet-core-deeplinks/testing` by consumers, never built.
import { describe, expect, it } from 'vitest'
import type { AddressCodec } from '@perawallet/wallet-core-chain-contract'
import { uriSchemeOf, type DeeplinkChainAdapter } from '../chain-adapter'
import type { ChainDeeplinkIntent } from '../models'

export interface DeeplinkAdapterContractFixtures {
    /** The adapter's own chain codec. */
    codec: AddressCodec
    /** Links the adapter must parse; together they cover every intent kind it produces. */
    links: readonly string[]
}

const FAILURES = ['malformed', 'unsupported-network', 'unsupported-action']

const SCHEME_FREE = [
    '',
    ' ',
    '\n',
    '\u0000',
    '﻿',
    '‮',
    '%',
    '%E0%A4%A',
    '?',
    '#',
    ':',
    '://',
    'javascript:alert(1)',
    '<script>alert(1)</script>',
    '{"mnemonic":"a b c"}',
    '__proto__',
    'constructor',
    'A'.repeat(10_000),
    '😀'.repeat(1_000),
]

const SCHEME_SUFFIXES = [
    '',
    '//',
    '?',
    '%',
    '%zz',
    '@',
    '@-1',
    '/?amount=-1',
    '?__proto__=1&constructor=1',
    '?amount=1e999999',
    'A'.repeat(10_000),
]

const APPENDED_PARAMS = [
    'amount=-1',
    'amount=1.5',
    'amount=1e400',
    'amount=NaN',
    'amount=Infinity',
    'amount=-0',
    'amount=0x10',
    'value=-1',
    'value=1.5',
    'value=1e-3',
    'asset=-1',
    'asset=1.5',
    'note=%',
    'label=%zz',
]

const buildCorpus = (
    schemes: readonly string[],
    links: readonly string[],
): string[] => {
    const corpus = [...SCHEME_FREE]
    for (const scheme of schemes) {
        for (const s of [scheme, scheme.toUpperCase()]) {
            for (const suffix of SCHEME_SUFFIXES) corpus.push(`${s}:${suffix}`)
            corpus.push(` ${s}:x`)
        }
    }
    for (const link of links) {
        for (let end = 0; end <= link.length; end++) {
            corpus.push(link.slice(0, end))
        }
        const joiner = link.includes('?') ? '&' : '?'
        for (const param of APPENDED_PARAMS)
            corpus.push(`${link}${joiner}${param}`)
    }
    return corpus
}

/** Every chain package runs this against its own deeplink adapter. */
export const deeplinkAdapterContractTests = (
    makeAdapter: () => DeeplinkChainAdapter,
    fixtures: DeeplinkAdapterContractFixtures,
): void => {
    const adapter = makeAdapter()
    const corpus = buildCorpus(adapter.schemes, fixtures.links)

    const okIntents = (): ChainDeeplinkIntent[] =>
        [...fixtures.links, ...corpus].flatMap(input => {
            const result = makeAdapter().parse(input)
            return result.ok ? [result.intent] : []
        })

    describe(`DeeplinkChainAdapter contract: ${adapter.chainId}`, () => {
        it('declares lowercase schemes without duplicates', () => {
            const { schemes } = makeAdapter()

            expect(schemes.length).toBeGreaterThan(0)
            for (const scheme of schemes) {
                expect(scheme).toMatch(/^[a-z][a-z0-9+.-]*$/)
            }
            expect(new Set(schemes).size).toBe(schemes.length)
        })

        it('parses every fixture link', () => {
            expect(fixtures.codec.chainId).toBe(adapter.chainId)
            expect(fixtures.links.length).toBeGreaterThan(0)
            for (const link of fixtures.links) {
                expect(makeAdapter().canParse(link)).toBe(true)
                expect(makeAdapter().parse(link).ok).toBe(true)
            }
        })

        it('never throws and only fails with a known reason', () => {
            for (const input of corpus) {
                const subject = makeAdapter()
                expect(() => subject.canParse(input)).not.toThrow()
                expect(() => subject.toAssetRef(input)).not.toThrow()
                expect(() => subject.parse(input)).not.toThrow()

                const result = subject.parse(input)
                if (!result.ok) expect(FAILURES).toContain(result.reason)
            }
        })

        it('agrees between canParse and parse', () => {
            for (const input of corpus) {
                const subject = makeAdapter()
                if (subject.canParse(input)) {
                    expect(subject.schemes).toContain(uriSchemeOf(input))
                } else {
                    expect(subject.parse(input)).toEqual({
                        ok: false,
                        reason: 'malformed',
                    })
                }
            }
        })

        it("keeps every intent and asset ref on the adapter's chain", () => {
            for (const intent of okIntents()) {
                if ('target' in intent) {
                    expect(intent.target.chainId).toBe(adapter.chainId)
                }
                if ('assetRef' in intent && intent.assetRef) {
                    expect(intent.assetRef.chainId).toBe(adapter.chainId)
                }
            }
            for (const input of corpus) {
                const ref = makeAdapter().toAssetRef(input)
                if (ref) expect(ref.chainId).toBe(adapter.chainId)
            }
        })

        it("accepts every intent address with the chain's codec", () => {
            for (const intent of okIntents()) {
                if (intent.kind === 'payment') {
                    expect(
                        fixtures.codec.isValid(
                            intent.recipient,
                            intent.target.networkId,
                        ),
                    ).toBe(true)
                } else if (
                    (intent.kind === 'address' ||
                        intent.kind === 'asset-opt-in') &&
                    intent.address !== undefined
                ) {
                    expect(
                        fixtures.codec.isValid(
                            intent.address,
                            intent.target.networkId,
                        ),
                    ).toBe(true)
                }
            }
        })

        it('builds every chain-action intent it produces', () => {
            const producesChainAction = okIntents().some(
                intent => intent.kind === 'chain-action',
            )
            if (producesChainAction) {
                expect(makeAdapter().buildChainAction).toBeTypeOf('function')
            }
        })

        it('carries payment amounts as non-negative integers in base units', () => {
            for (const intent of okIntents()) {
                if (intent.kind === 'payment' && intent.amount) {
                    expect(intent.amount.isFinite()).toBe(true)
                    expect(intent.amount.isInteger()).toBe(true)
                    expect(intent.amount.isNegative()).toBe(false)
                }
            }
        })
    })
}
