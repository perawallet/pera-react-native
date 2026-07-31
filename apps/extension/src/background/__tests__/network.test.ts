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
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { parseActiveNetwork, resolveAdvertisedGenesis } from '../network'

describe('parseActiveNetwork', () => {
    it('reads testnet from the persisted zustand envelope string', () => {
        const raw = '{"state":{"network":"testnet"},"version":1}'
        expect(parseActiveNetwork(raw)).toBe('testnet')
    })

    it('reads mainnet from the persisted zustand envelope string', () => {
        const raw = '{"state":{"network":"mainnet"},"version":1}'
        expect(parseActiveNetwork(raw)).toBe('mainnet')
    })

    it('defaults to mainnet when the entry is missing (undefined)', () => {
        expect(parseActiveNetwork(undefined)).toBe('mainnet')
    })

    it('defaults to mainnet on malformed JSON', () => {
        expect(parseActiveNetwork('{not json')).toBe('mainnet')
    })

    it('defaults to mainnet when state/network is absent from an otherwise valid envelope', () => {
        expect(parseActiveNetwork('{"version":1}')).toBe('mainnet')
    })

    it('accepts every supported network', () => {
        for (const network of ['mainnet', 'testnet', 'betanet', 'custom']) {
            const raw = `{"state":{"network":"${network}"},"version":1}`
            expect(parseActiveNetwork(raw)).toBe(network)
        }
    })

    it('still falls back to mainnet for an unknown value', () => {
        expect(
            parseActiveNetwork('{"state":{"network":"nope"},"version":1}'),
        ).toBe('mainnet')
    })

    it('falls back to mainnet for a value no longer in the union', () => {
        // Regression coverage for the custom-network rework: a device that
        // persisted 'fnet' (or 'localnet') under the old five-network union
        // must not crash or silently accept a value SUPPORTED no longer
        // contains — it degrades to the same safe mainnet default as any
        // other unrecognized string.
        expect(
            parseActiveNetwork('{"state":{"network":"fnet"},"version":1}'),
        ).toBe('mainnet')
    })
})

describe('resolveAdvertisedGenesis', () => {
    const CUSTOM_ENVELOPE = JSON.stringify({
        state: {
            customNetwork: {
                algodUrl: 'http://10.0.0.5:4001',
                indexerUrl: 'http://10.0.0.5:8980',
                genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
                genesisId: 'dockernet-v1',
            },
        },
        version: 1,
    })

    const MAINNET = {
        genesisHash: getNetworkConfig(Networks.mainnet).genesisHash,
        genesisId: getNetworkConfig(Networks.mainnet).genesisId,
    }

    it.each([Networks.mainnet, Networks.testnet, Networks.betanet] as const)(
        'advertises %s from the baked chain table, ignoring any custom config',
        network => {
            expect(resolveAdvertisedGenesis(network, CUSTOM_ENVELOPE)).toEqual({
                genesisHash: getNetworkConfig(network).genesisHash,
                genesisId: getNetworkConfig(network).genesisId,
            })
        },
    )

    it('advertises the custom slot config when custom is active', () => {
        // The whole point: `custom`'s baked chain-table row is empty by design,
        // so reading getNetworkConfig('custom') here handed every dApp
        // genesisHash: '' over ARC-0027 discover/enable.
        expect(
            resolveAdvertisedGenesis(Networks.custom, CUSTOM_ENVELOPE),
        ).toEqual({
            genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
            genesisId: 'dockernet-v1',
        })
    })

    it.each([
        ['a missing storage entry', undefined],
        ['malformed JSON', '{not json'],
        ['an envelope with no customNetwork', '{"state":{},"version":1}'],
        [
            'a null customNetwork',
            '{"state":{"customNetwork":null},"version":1}',
        ],
        [
            'a config with an empty genesis hash',
            '{"state":{"customNetwork":{"genesisHash":"","genesisId":"x"}},"version":1}',
        ],
        [
            'a config with a non-string genesis hash',
            '{"state":{"customNetwork":{"genesisHash":7,"genesisId":"x"}},"version":1}',
        ],
    ])(
        'falls back to mainnet with %s rather than advertising an empty chain identity',
        (_label, raw) => {
            // Same rule parseActiveNetwork already applies to every value it
            // cannot use: degrade to mainnet. An empty genesis hash is never a
            // valid chain identity — advertising one is worse than advertising
            // the wrong one, since a dApp cannot detect it as missing.
            expect(resolveAdvertisedGenesis(Networks.custom, raw)).toEqual(
                MAINNET,
            )
        },
    )

    it('advertises an empty genesis id from a config that carries one, without falling back', () => {
        // genesisId is not signature-bound, so an empty one is not grounds to
        // discard an otherwise valid custom chain identity.
        expect(
            resolveAdvertisedGenesis(
                Networks.custom,
                '{"state":{"customNetwork":{"genesisHash":"HASH=","genesisId":""}},"version":1}',
            ),
        ).toEqual({ genesisHash: 'HASH=', genesisId: '' })
    })
})
