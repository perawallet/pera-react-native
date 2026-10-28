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
    isCompleteList,
    parseMetaMaskPhishingConfig,
    parseMewDarklist,
    parsePolkadotPhishingList,
    PHISHING_LIST_SOURCES,
} from '../sources'
import { evmAddressList, hostList, mewDarklist } from './fixtures'

describe('parseMetaMaskPhishingConfig', () => {
    it('maps the blocklist, allowlist and fuzzylist', () => {
        expect(
            parseMetaMaskPhishingConfig({
                version: 2,
                tolerance: 1,
                blacklist: ['Phish.Example', 'xn--phntom-jta.com'],
                whitelist: ['walletconnect.com'],
                fuzzylist: ['opensea.io'],
            }),
        ).toEqual({
            deny: ['phish.example', 'xn--phntom-jta.com'],
            allow: ['walletconnect.com'],
            impersonationTargets: ['opensea.io'],
            addresses: [],
        })
    })

    it('drops paths, wildcards, dot-less entries and duplicates', () => {
        expect(
            parseMetaMaskPhishingConfig({
                blacklist: [
                    'sites.google.com/view/phish',
                    '*.phish.example',
                    'localhost',
                    'bad entry.com',
                    'phish.example',
                    'PHISH.example',
                ],
                whitelist: [],
                fuzzylist: [],
            })?.deny,
        ).toEqual(['phish.example'])
    })

    it.each([
        null,
        'text',
        {},
        { blacklist: 'x', whitelist: [], fuzzylist: [] },
    ])('rejects a malformed config %#', raw => {
        expect(parseMetaMaskPhishingConfig(raw)).toBeUndefined()
    })
})

describe('parsePolkadotPhishingList', () => {
    it('reads deny entries and ignores the platform allow hints', () => {
        expect(
            parsePolkadotPhishingList({
                allow: ['vercel.app'],
                deny: ['dot-airdrop.example'],
            }),
        ).toEqual({
            deny: ['dot-airdrop.example'],
            allow: [],
            impersonationTargets: [],
            addresses: [],
        })
    })

    it('rejects a malformed list', () => {
        expect(parsePolkadotPhishingList({ deny: [1, 2] })).toBeUndefined()
    })
})

describe('parseMewDarklist', () => {
    it('keeps valid addresses as lowercase keys and ignores the extra fields', () => {
        expect(
            parseMewDarklist([
                {
                    address: '0x09750ad360fdb7A2ee23669C4503c974D86D8694',
                    comment: 'XRP phishing website',
                    date: '2020-11-17',
                },
                { address: '0x09750AD360FDB7A2EE23669C4503C974D86D8694' },
                { address: 'not-an-address' },
                { address: '0x1234' },
            ]),
        ).toEqual({
            deny: [],
            allow: [],
            impersonationTargets: [],
            addresses: ['0x09750ad360fdb7a2ee23669c4503c974d86d8694'],
        })
    })

    it.each([null, {}, [{ wallet: '0x0' }], [{ address: 1 }]])(
        'rejects a malformed list %#',
        raw => {
            expect(parseMewDarklist(raw)).toBeUndefined()
        },
    )
})

describe('isCompleteList', () => {
    const sourceOf = (id: string) => {
        const source = PHISHING_LIST_SOURCES.find(entry => entry.id === id)
        if (!source) throw new Error(id)
        return source
    }

    it('rejects a darklist shorter than its floor', () => {
        const source = sourceOf('mew-darklist')
        const short = parseMewDarklist(
            mewDarklist(evmAddressList(source.minimumAddressEntries - 1)),
        )
        const full = parseMewDarklist(
            mewDarklist(evmAddressList(source.minimumAddressEntries)),
        )

        expect(short && isCompleteList(source, short)).toBe(false)
        expect(full && isCompleteList(source, full)).toBe(true)
    })

    it('rejects a domain list shorter than its deny floor', () => {
        const source = sourceOf('polkadot')
        const short = parsePolkadotPhishingList({
            deny: hostList(source.minimumDenyEntries - 1, 'dot'),
        })

        expect(short && isCompleteList(source, short)).toBe(false)
    })
})
