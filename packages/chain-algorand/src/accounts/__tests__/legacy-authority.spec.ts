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
import { decodeAlgorandLegacyAuthority } from '../legacy-authority'

describe('decodeAlgorandLegacyAuthority', () => {
    it('reads a per-network authority under each scope key', () => {
        expect(
            decodeAlgorandLegacyAuthority({
                address: 'A',
                rekeyAddress: 'MAIN',
                rekeyAddressByNetwork: { mainnet: 'MAIN', testnet: 'TEST' },
            }),
        ).toEqual({
            byScope: { 'algorand/mainnet': 'MAIN', 'algorand/testnet': 'TEST' },
        })
    })

    it('keeps a map already keyed by scope', () => {
        expect(
            decodeAlgorandLegacyAuthority({
                rekeyAddressByNetwork: { 'algorand/testnet': 'TEST' },
            }),
        ).toEqual({ byScope: { 'algorand/testnet': 'TEST' } })
    })

    it('reads a lone authority that predates the per-network map as unscoped', () => {
        expect(
            decodeAlgorandLegacyAuthority({
                address: 'A',
                rekeyAddress: 'AUTH',
            }),
        ).toEqual({ byScope: {}, unscoped: 'AUTH' })
    })

    it('drops unreadable networks and empty authorities', () => {
        expect(
            decodeAlgorandLegacyAuthority({
                rekeyAddressByNetwork: { 'not-a-network': 'X', testnet: '' },
            }),
        ).toBeUndefined()
        expect(
            decodeAlgorandLegacyAuthority({ rekeyAddress: '' }),
        ).toBeUndefined()
    })

    it('decodes nothing from a record without authority or a malformed one', () => {
        for (const raw of [
            null,
            undefined,
            'record',
            [],
            { address: 'A' },
            { rekeyAddress: 7 },
            { rekeyAddressByNetwork: 'mainnet' },
        ]) {
            expect(decodeAlgorandLegacyAuthority(raw)).toBeUndefined()
        }
    })
})
