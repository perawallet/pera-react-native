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
import { sendFlowChainAdapters } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID, registerAlgorandChain } from '..'
import { algorandSendFlowAdapter } from '../asa-inbox/adapter'

describe('registerAlgorandChain', () => {
    beforeEach(() => {
        sendFlowChainAdapters.reset()
    })

    it('registers the Algorand send-flow adapter', () => {
        registerAlgorandChain()

        expect(sendFlowChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandSendFlowAdapter,
        )
    })

    it('can run more than once, so a repeated bootstrap is harmless', () => {
        expect(() => {
            registerAlgorandChain()
            registerAlgorandChain()
        }).not.toThrow()
    })
})
