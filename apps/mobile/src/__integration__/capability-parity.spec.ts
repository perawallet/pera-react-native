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

import { describe, expect, it, vi } from 'vitest'
import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import { assetsChainAdapters } from '@perawallet/wallet-core-assets'
import { backupChainAdapters } from '@perawallet/wallet-core-backup'
import { cardChainAdapters } from '@perawallet/wallet-core-card'
import {
    addressCodecs,
    CHAIN_IDS,
    createChainRegistry,
    transactionPlanners,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { customNodeAdapters } from '@perawallet/wallet-core-chain-shared'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import { nameServiceChainAdapters } from '@perawallet/wallet-core-nfd'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
import {
    broadcasterChainAdapters,
    localKeySignerChainAdapters,
    messageSignerChainAdapters,
    plannerChainAdapters,
    reviewerChainAdapters,
} from '@perawallet/wallet-core-signing'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import {
    historyChainAdapters,
    sendFlowChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    capabilityAdapterContractTests,
    capabilityAdapterContractViolations,
    FIXTURE_CHAIN_ID,
    type CapabilityAdapterRegistries,
} from '@packages/chain-contract/src/__tests__/testing'
import { allCapabilities } from '@test-utils/chain-fixtures'

// The integration setup registers the real chains after this mock applies, so
// the suite sees every chain the app can ship, not just the default build's.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    const { CHAIN_IDS: allChainIds } =
        await import('@perawallet/wallet-core-chain-contract')
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: [...allChainIds], capabilities: {} },
        },
    }
})

const registries: CapabilityAdapterRegistries = {
    'send flow': sendFlowChainAdapters,
    planner: plannerChainAdapters,
    transactionPlanner: transactionPlanners,
    reviewer: reviewerChainAdapters,
    'local-key signer': localKeySignerChainAdapters,
    broadcaster: broadcasterChainAdapters,
    addressCodec: addressCodecs,
    accounts: accountsChainAdapters,
    'transaction history': historyChainAdapters,
    assets: assetsChainAdapters,
    'message signer': messageSignerChainAdapters,
    'dapp-request': dappRequestChainAdapters,
    'ledger app driver': ledgerAppDriverRegistry,
    multisig: multisigChainAdapters,
    swap: swapChainAdapters,
    card: cardChainAdapters,
    'name service': nameServiceChainAdapters,
    ramp: rampChainAdapters,
    backup: backupChainAdapters,
    'custom node': customNodeAdapters,
}

describe('composition-root capability parity', () => {
    it('registers every chain the app ships', () => {
        const ids = getProvider()
            .chains.list()
            .map(({ id }) => id)

        expect([...ids].sort()).toEqual([...CHAIN_IDS].sort())
    })

    capabilityAdapterContractTests(getProvider().chains, registries)

    it('fails when a chain enables send without a broadcaster', () => {
        const fixture = createChainRegistry()
        fixture.register(
            {
                id: FIXTURE_CHAIN_ID,
                networks: [],
            } as unknown as ChainDescriptor,
            { ...allCapabilities(false), send: true },
        )

        expect(
            capabilityAdapterContractViolations(fixture, registries),
        ).toContain(
            'chain "fixturehex" enables "send" but the "broadcaster" registry has no adapter for it',
        )
    })
})
