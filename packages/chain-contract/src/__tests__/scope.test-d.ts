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

import { describe, expectTypeOf, it } from 'vitest'
import type { ChainScope, ChainScopeKey } from '../models/identity'
import { parseScopeKey, toScopeKey } from '../scope'

describe('scope key codec', () => {
    it('mints a ChainScopeKey from a ChainScope', () => {
        expectTypeOf(toScopeKey).parameter(0).toEqualTypeOf<ChainScope>()
        expectTypeOf(toScopeKey).returns.toEqualTypeOf<ChainScopeKey>()
    })

    it('parses any string back to a ChainScope', () => {
        expectTypeOf(parseScopeKey).parameter(0).toEqualTypeOf<string>()
        expectTypeOf(parseScopeKey).returns.toEqualTypeOf<ChainScope>()
    })
})
