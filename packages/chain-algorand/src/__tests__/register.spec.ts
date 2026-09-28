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
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID, registerChain } from '..'
import { algorandDappRequestAdapter } from '../connect'
import { sendFlowChainAdapters } from '@perawallet/wallet-core-transactions'
import { algorandSendFlowAdapter } from '../asa-inbox/adapter'
import { algorandLedgerAppDriver } from '../ledger'
import { algorandSwapAdapter } from '../swaps'

describe('registerChain', () => {
    beforeEach(() => {
        ledgerAppDriverRegistry.reset()
        swapChainAdapters.reset()
        dappRequestChainAdapters.reset()
        sendFlowChainAdapters.reset()
    })

    it('registers the Algorand swap adapter', () => {
        registerChain()

        expect(swapChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandSwapAdapter,
        )
    })

    it('registers the dApp request adapter', () => {
        registerChain()

        expect(dappRequestChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandDappRequestAdapter,
        )
    })

    it('registers the Algorand send-flow adapter', () => {
        registerChain()

        expect(sendFlowChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandSendFlowAdapter,
        )
    })

    it('can run more than once, so a repeated bootstrap is harmless', () => {
        expect(() => {
            registerChain()
            registerChain()
        }).not.toThrow()
    })

    it('registers the Algorand Ledger app driver', () => {
        registerChain()

        expect(ledgerAppDriverRegistry.resolve(ALGORAND_CHAIN_ID)).toBe(
            algorandLedgerAppDriver,
        )
    })
})
