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

import { createLocalChromeFake } from './chrome-fake'
import { parseActiveDeployment, readActiveDeployment } from '../network'

describe('parseActiveDeployment', () => {
    it('defaults to live when the entry is missing (undefined)', () => {
        expect(parseActiveDeployment(undefined)).toBe('live')
    })

    it('defaults to live on malformed JSON', () => {
        expect(parseActiveDeployment('{not json')).toBe('live')
    })

    it('defaults to live when the state is absent from an otherwise valid envelope', () => {
        expect(parseActiveDeployment('{"version":1}')).toBe('live')
    })
})

describe('parseActiveDeployment across store versions', () => {
    const v1 = (network: string) =>
        JSON.stringify({ state: { network }, version: 1 })
    const v2 = (network: string) =>
        JSON.stringify({
            state: {
                selectedNetworkByChain: { algorand: network },
                customNetworksByChain: { algorand: [] },
            },
            version: 2,
        })
    const v3 = (
        mode: string,
        network: string,
        selectedNetworkByChain: Record<string, string> = {},
    ) =>
        JSON.stringify({
            state: {
                mode,
                network,
                selectedNetworkByChain,
                customNetworksByChain: { algorand: [] },
            },
            version: 3,
        })

    // Only MainNet was live before the mode existed; an unknown value, such as
    // 'fnet' from the old five-network union, degrades to live like any other.
    it.each([
        ['mainnet', 'live'],
        ['testnet', 'developer'],
        ['betanet', 'developer'],
        ['custom', 'developer'],
        ['fnet', 'live'],
        ['nope', 'live'],
    ])('v1 and v2: %s resolves to %s', (persisted, expected) => {
        expect(parseActiveDeployment(v1(persisted))).toBe(expected)
        expect(parseActiveDeployment(v2(persisted))).toBe(expected)
    })

    it.each([
        [
            'live mode ignores a stored Algorand override',
            v3('live', 'mainnet', { algorand: 'betanet' }),
            'live',
        ],
        ['developer with no override', v3('developer', 'testnet'), 'developer'],
        [
            'developer with a betanet override still reaches the developer deployment',
            v3('developer', 'betanet', { algorand: 'betanet' }),
            'developer',
        ],
    ])('v3: %s', (_label, raw, expected) => {
        expect(parseActiveDeployment(raw)).toBe(expected)
    })
})

describe('readActiveDeployment', () => {
    it('reads the deployment from chrome.storage.local', async () => {
        const fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome
        fake.local.set(
            'kv:network-store',
            '{"state":{"mode":"developer","network":"betanet"},"version":3}',
        )

        expect(await readActiveDeployment()).toBe('developer')
    })

    it('defaults to live when nothing is stored', async () => {
        const fake = createLocalChromeFake()
        globalThis.chrome = fake.chrome

        expect(await readActiveDeployment()).toBe('live')
    })
})
