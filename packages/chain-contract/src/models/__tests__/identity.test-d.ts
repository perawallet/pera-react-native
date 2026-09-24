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

import { assertType, describe, expectTypeOf, it } from 'vitest'
import type { ChainScopeKey } from '../identity'

describe('ChainScopeKey', () => {
    it('is not assignable from a string literal that matches its shape', () => {
        // @ts-expect-error a key has to come from toScopeKey
        assertType<ChainScopeKey>('algorand/mainnet')
        expectTypeOf<'algorand/mainnet'>().not.toExtend<ChainScopeKey>()
    })

    it('is not assignable from a plain string', () => {
        const key: string = 'algorand/mainnet'

        // @ts-expect-error a key has to come from toScopeKey
        assertType<ChainScopeKey>(key)
        expectTypeOf<string>().not.toExtend<ChainScopeKey>()
    })

    it('is still usable wherever a string is expected', () => {
        expectTypeOf<ChainScopeKey>().toExtend<string>()
    })
})
