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
    parseMetaMaskPhishingConfig,
    parsePolkadotPhishingList,
} from '../sources'

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
        })
    })

    it('rejects a malformed list', () => {
        expect(parsePolkadotPhishingList({ deny: [1, 2] })).toBeUndefined()
    })
})
