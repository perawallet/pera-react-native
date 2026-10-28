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

import type { PhishingListSnapshot } from '../models'

/** Enough hosts to clear a source's truncation floor. */
export const hostList = (count: number, prefix: string): string[] =>
    Array.from({ length: count }, (_, i) => `${prefix}${i}.example`)

export const metaMaskConfig = ({
    deny = [],
    allow = [],
    fuzzy = [],
}: {
    deny?: string[]
    allow?: string[]
    fuzzy?: string[]
}) => ({
    version: 2,
    tolerance: 1,
    blacklist: deny,
    whitelist: allow,
    fuzzylist: fuzzy,
})

export const polkadotList = (deny: string[]) => ({ allow: [], deny })

export const FIXTURE_SNAPSHOT: PhishingListSnapshot = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sources: {
        metamask: {
            deny: 'bundled-phish.example\nshared-phish.example',
            allow: 'allowed.example',
            impersonationTargets: 'cryptokitties.co',
        },
        polkadot: {
            deny: 'bundled-dot.example',
            allow: '',
            impersonationTargets: '',
        },
    },
}
