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
import { DAPP_LOGO_STACK_MAX, dappLogoStack } from '../dappLogoStack'

describe('dappLogoStack', () => {
    it(`shows up to ${DAPP_LOGO_STACK_MAX} logos and counts the rest`, () => {
        expect(dappLogoStack(['a', null, 'c'], 5)).toEqual({
            visible: ['a', null, 'c'],
            hiddenCount: 2,
        })
    })

    it('has no "+N" when every dApp is visible', () => {
        expect(dappLogoStack(['a', 'b'], 2)).toEqual({
            visible: ['a', 'b'],
            hiddenCount: 0,
        })
    })

    it('takes only the first logos when given more', () => {
        expect(dappLogoStack(['a', 'b', 'c', 'd'], 4)).toEqual({
            visible: ['a', 'b', 'c'],
            hiddenCount: 1,
        })
    })

    it('is empty for an empty folder', () => {
        expect(dappLogoStack([], 0)).toEqual({ visible: [], hiddenCount: 0 })
    })
})
