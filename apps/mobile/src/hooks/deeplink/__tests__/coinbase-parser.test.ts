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


import { parseCoinbaseFormat } from '../coinbase-parser'

describe('Coinbase Parser', () => {
    it('returns null for invalid scheme', () => {
        expect(parseCoinbaseFormat('perawallet://test')).toBeNull()
    })

    it('returns null for invalid action', () => {
        expect(parseCoinbaseFormat('algo:123/invalid?address=test')).toBeNull()
    })

    it('returns null for missing address', () => {
        expect(parseCoinbaseFormat('algo:123/transfer')).toBeNull()
    })

    it('returns null for malformed path', () => {
        expect(parseCoinbaseFormat('algo:123')).toBeNull()
    })
})
