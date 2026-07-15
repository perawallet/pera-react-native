/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { parseActiveNetwork } from '../network'

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

    it('defaults to mainnet on an unknown network value', () => {
        const raw = '{"state":{"network":"betanet"},"version":1}'
        expect(parseActiveNetwork(raw)).toBe('mainnet')
    })

    it('defaults to mainnet when state/network is absent from an otherwise valid envelope', () => {
        expect(parseActiveNetwork('{"version":1}')).toBe('mainnet')
    })
})
