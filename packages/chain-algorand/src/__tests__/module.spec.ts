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

import {
    beforeAll,
    beforeEach,
    describe,
    expect,
    expectTypeOf,
    it,
} from 'vitest'
import {
    CHAIN_CAPABILITIES,
    createChainRegistry,
    registerChainSetup,
    type ChainContext,
    type ChainModule,
    type ChainSetup,
} from '@perawallet/wallet-core-chain-contract'
import { capabilityAdapterContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import { assetsChainAdapters } from '@perawallet/wallet-core-assets'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import {
    historyChainAdapters,
    sendFlowChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { nameServiceChainAdapters } from '@perawallet/wallet-core-nfd'
import { cardChainAdapters } from '@perawallet/wallet-core-card'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
import { messageSignerChainAdapters } from '@perawallet/wallet-core-signing'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import { backupChainAdapters } from '@perawallet/wallet-core-backup'
import { chainModule } from '..'
import { algorandDappRequestAdapter } from '../connect'
import {
    algorandHistoryAdapter,
    algorandSendFlowAdapter,
} from '../transactions'
import { algorandLedgerAppDriver } from '../ledger'
import { algorandSwapAdapter } from '../swaps'
import { algorandAssetsAdapter } from '../assets'
import { algorandNameServiceAdapter } from '../nfd'
import { algorandCardAdapter } from '../card'
import { algorandRampAdapter } from '../onramp'
import { algorandMessageSignerAdapter } from '../signing'
import { algorandMultisigAdapter } from '../multisig'
import { algorandBackupAdapter } from '../backup'
import { algorandPinnedHosts } from '../blockchain/pinned-hosts'
import { algorandRemoteConfigDefaults } from '../blockchain/remote-config'

// register ignores its context: the adapters are module-level instances.
const stubCtx = {} as ChainContext

const setup: ChainSetup = [
    { chainId: 'algorand', enabled: true, module: chainModule, endpoints: {} },
]

const resetAdapters = () => {
    ledgerAppDriverRegistry.reset()
    assetsChainAdapters.reset()
    swapChainAdapters.reset()
    dappRequestChainAdapters.reset()
    sendFlowChainAdapters.reset()
    historyChainAdapters.reset()
    nameServiceChainAdapters.reset()
    cardChainAdapters.reset()
    rampChainAdapters.reset()
    messageSignerChainAdapters.reset()
    multisigChainAdapters.reset()
    backupChainAdapters.reset()
}

const expectAdaptersRegistered = () => {
    expect(ledgerAppDriverRegistry.resolve('algorand')).toBe(
        algorandLedgerAppDriver,
    )
    expect(assetsChainAdapters.get('algorand')).toBe(algorandAssetsAdapter)
    expect(swapChainAdapters.get('algorand')).toBe(algorandSwapAdapter)
    expect(dappRequestChainAdapters.get('algorand')).toBe(
        algorandDappRequestAdapter,
    )
    expect(sendFlowChainAdapters.get('algorand')).toBe(algorandSendFlowAdapter)
    expect(historyChainAdapters.get('algorand')).toBe(algorandHistoryAdapter)
    expect(nameServiceChainAdapters.get('algorand')).toBe(
        algorandNameServiceAdapter,
    )
    expect(cardChainAdapters.get('algorand')).toBe(algorandCardAdapter)
    expect(rampChainAdapters.get('algorand')).toBe(algorandRampAdapter)
    expect(messageSignerChainAdapters.get('algorand')).toBe(
        algorandMessageSignerAdapter,
    )
    expect(multisigChainAdapters.get('algorand')).toBe(algorandMultisigAdapter)
    expect(backupChainAdapters.get('algorand')).toBe(algorandBackupAdapter)
}

describe('chainModule', () => {
    beforeEach(resetAdapters)

    it('is typed as a ChainModule', () => {
        expectTypeOf(chainModule).toEqualTypeOf<ChainModule>()
    })

    it('declares its remote-config defaults and pinned node hosts', () => {
        expect(chainModule.remoteConfigDefaults).toBe(
            algorandRemoteConfigDefaults,
        )
        expect(chainModule.pinnedHosts).toBe(algorandPinnedHosts)
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
            Object.fromEntries(
                CHAIN_CAPABILITIES.map(c => [
                    c,
                    c !== 'privateKeys' && c !== 'contractDecoding',
                ]),
            ),
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

// A sibling suite, not nested under `chainModule`: its own chain registry and
// its own one-time setup, untouched by that describe's per-test resetAdapters.
describe('capability-to-adapter parity (algorand)', () => {
    const chains = createChainRegistry()

    beforeAll(() => {
        resetAdapters()
        registerChainSetup(setup, chains, () => stubCtx)
    })

    capabilityAdapterContractTests(chains, {
        'send flow': sendFlowChainAdapters,
        'transaction history': historyChainAdapters,
        assets: assetsChainAdapters,
        swap: swapChainAdapters,
        'name service': nameServiceChainAdapters,
        card: cardChainAdapters,
        ramp: rampChainAdapters,
        'dapp-request': dappRequestChainAdapters,
        'ledger app driver': ledgerAppDriverRegistry,
        'message signer': messageSignerChainAdapters,
        multisig: multisigChainAdapters,
        backup: backupChainAdapters,
    })
})
