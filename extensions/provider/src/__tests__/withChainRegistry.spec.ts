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
import { WithChainRegistry } from '../withChainRegistry'

describe('WithChainRegistry', () => {
    it('puts one empty chain registry on the provider', () => {
        const provider: Record<string, unknown> = {}

        const { chains } = WithChainRegistry(provider)

        expect(provider.chains).toBe(chains)
        expect(chains.list()).toEqual([])
    })
})
