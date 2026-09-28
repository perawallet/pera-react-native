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

import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    createChainRegistry,
    registerChainSetup,
    type ChainContext,
    type ChainModule,
    type ChainSetup,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import { sendFlowChainAdapters } from '@perawallet/wallet-core-transactions'
import { nameServiceChainAdapters } from '@perawallet/wallet-core-nfd'
import { cardChainAdapters } from '@perawallet/wallet-core-card'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
import { chainModule } from '..'
import { algorandDappRequestAdapter } from '../connect'
import { algorandSendFlowAdapter } from '../asa-inbox/adapter'
import { algorandLedgerAppDriver } from '../ledger'
import { algorandSwapAdapter } from '../swaps'
import { algorandNameServiceAdapter } from '../nfd'
import { algorandCardAdapter } from '../card'
import { algorandRampAdapter } from '../onramp'

// register ignores its context: the adapters are module-level instances.
const stubCtx = {} as ChainContext

const setup: ChainSetup = [
    { chainId: 'algorand', enabled: true, module: chainModule, endpoints: {} },
]

const resetAdapters = () => {
    ledgerAppDriverRegistry.reset()
    swapChainAdapters.reset()
    dappRequestChainAdapters.reset()
    sendFlowChainAdapters.reset()
    nameServiceChainAdapters.reset()
    cardChainAdapters.reset()
    rampChainAdapters.reset()
}

const expectAdaptersRegistered = () => {
    expect(ledgerAppDriverRegistry.resolve('algorand')).toBe(
        algorandLedgerAppDriver,
    )
    expect(swapChainAdapters.get('algorand')).toBe(algorandSwapAdapter)
    expect(dappRequestChainAdapters.get('algorand')).toBe(
        algorandDappRequestAdapter,
    )
    expect(sendFlowChainAdapters.get('algorand')).toBe(algorandSendFlowAdapter)
    expect(nameServiceChainAdapters.get('algorand')).toBe(
        algorandNameServiceAdapter,
    )
    expect(cardChainAdapters.get('algorand')).toBe(algorandCardAdapter)
    expect(rampChainAdapters.get('algorand')).toBe(algorandRampAdapter)
}

describe('chainModule', () => {
    beforeEach(resetAdapters)

    it('is typed as a ChainModule', () => {
        expectTypeOf(chainModule).toEqualTypeOf<ChainModule>()
    })

    it('registers the descriptor and every adapter through the chain setup', () => {
        const chains = createChainRegistry()

        registerChainSetup(setup, chains, () => stubCtx)

        expect(chains.get('algorand').descriptor).toBe(chainModule.descriptor)
        expect(
            chains.byCaip2('algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k')?.network
                .id,
        ).toBe('mainnet')
        expect(chains.capabilities('algorand')).toEqual(
            Object.fromEntries(CHAIN_CAPABILITIES.map(c => [c, true])),
        )
        expectAdaptersRegistered()
    })

    it('is a no-op when registered again with the same instances', () => {
        const chains = createChainRegistry()
        registerChainSetup(setup, chains, () => stubCtx)

        expect(() => {
            registerChainSetup(setup, chains, () => stubCtx)
            chainModule.register(stubCtx)
        }).not.toThrow()
        expect(chains.get('algorand').descriptor).toBe(chainModule.descriptor)
        expectAdaptersRegistered()
    })

    it('leaves a feature registry without its adapter throwing for algorand', () => {
        chainModule.register(stubCtx)
        resetAdapters()

        const notRegistered = expect.objectContaining({
            name: 'ChainAdapterNotRegisteredError',
            chainId: 'algorand',
        })
        expect(() => swapChainAdapters.get('algorand')).toThrow(notRegistered)
        expect(() => cardChainAdapters.get('algorand')).toThrow(notRegistered)
    })
})
