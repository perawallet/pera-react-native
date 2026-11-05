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
import { createEvmAddressCodec } from '../../accounts/address-codec'
import { BASE } from '../../__tests__/evm-chains'
import { createEvmNameServiceAdapter } from '../adapter'

const adapter = createEvmNameServiceAdapter(BASE, createEvmAddressCodec(BASE))

describe('the EVM name-service adapter', () => {
    it.each([
        ['Alice.ETH', 'alice.eth'],
        ['ａlice.eth', 'alice.eth'],
    ])('reads %s as the ENSIP-15 form %s', (input, expected) => {
        expect(adapter.normalizeName?.(input)).toBe(expected)
    })

    it('refuses a name the normaliser rejects', () => {
        expect(adapter.normalizeName?.('al_ice.eth')).toBeUndefined()
    })
})
