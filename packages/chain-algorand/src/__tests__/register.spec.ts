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

import { beforeEach, describe, expect, it } from 'vitest'
import { cardChainAdapters } from '@perawallet/wallet-core-card'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
import { ALGORAND_CHAIN_ID, registerAlgorandChain } from '..'
import { algorandCardAdapter } from '../card'
import { algorandRampAdapter } from '../onramp'

describe('registerAlgorandChain', () => {
    beforeEach(() => {
        cardChainAdapters.reset()
        rampChainAdapters.reset()
    })

    it('registers the Algorand card and ramp adapters', () => {
        registerAlgorandChain()

        expect(cardChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandCardAdapter,
        )
        expect(rampChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandRampAdapter,
        )
    })

    it('can run more than once, so a repeated bootstrap is harmless', () => {
        expect(() => {
            registerAlgorandChain()
            registerAlgorandChain()
        }).not.toThrow()
    })
})
