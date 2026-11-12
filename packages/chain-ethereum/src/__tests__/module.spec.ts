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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import { deeplinkAdapters } from '@perawallet/wallet-core-deeplinks'
import {
    historyChainAdapters,
    transferChainAdapters,
} from '@perawallet/wallet-core-transactions'
import {
    addressCodecs,
    createChainRegistry,
    keyDerivations,
    registerChainSetup,
    transactionPlanners,
    transactionReviewers,
    type ChainContext,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumModule, evmChainModules } from '..'
import { evmCapabilityDefaults } from '../capability-defaults'
import { createEvmChain } from '../chains/create-evm-chain'
import { createEvmChainModule } from '../module'
import { BASE, eip155IdOf, EVM_TEST_CHAINS } from './evm-chains'

const context: ChainContext = {
    getScope: vi.fn(),
    getEndpoints: vi.fn(),
    kms: { deriveFromSeed: vi.fn(), importRawKey: vi.fn(), sign: vi.fn() },
} as unknown as ChainContext

const ENABLED = [
    'send',
    'receive',
    'history',
    'assets',
    'assetSearch',
    'pricing',
    'priceHistory',
    'balanceHistory',
    'watchAccounts',
    'privateKeys',
    'dappConnect',
    'messageSigning',
    'ledger',
    'nft',
    'nameService',
    'contractDecoding',
    'cloudBackup',
]

describe('ethereumModule', () => {
    it('is the Ethereum row of the EVM modules', () => {
        expect(ethereumModule).toBe(evmChainModules.ethereum)
        expect(ethereumModule.descriptor.id).toBe('ethereum')
    })
})

describe.each(EVM_TEST_CHAINS)('the $row.id module', chain => {
    const id = chain.row.id
    const module = evmChainModules[id]

    beforeEach(() => {
        addressCodecs.reset()
        keyDerivations.reset()
        transactionPlanners.reset()
        transactionReviewers.reset()
        accountsChainAdapters.reset()
        transferChainAdapters.reset()
        historyChainAdapters.reset()
        deeplinkAdapters.reset()
    })

    it('switches on exactly the launch capabilities', () => {
        const enabled = Object.entries(module.capabilityDefaults)
            .filter(([, isOn]) => isOn)
            .map(([capability]) => capability)

        // The rows that default swap on, in this test environment.
        const launch =
            id === 'ethereum'
                ? [...ENABLED, 'swap', 'onramp']
                : id === 'base' || id === 'arbitrum'
                  ? [...ENABLED, 'swap']
                  : ENABLED
        expect(enabled.sort()).toEqual([...launch].sort())
    })

    it('supports nothing that reaches Algorand-only code or a Pera endpoint EVM lacks, so remote config cannot switch it on', () => {
        for (const capability of [
            'assetInbox',
            'rekey',
            'staking',
            'manageAssets',
            'multisig',
            'quantumAccounts',
            'liquidAuth',
            'feeDelegation',
            'notifications',
            'assetFavorites',
            'priceAlerts',
            'csvExport',
        ] as const) {
            expect(module.supportedCapabilities).not.toContain(capability)
        }
    })

    it('declares its own pinning kill switch, off until remote config turns it on', () => {
        expect(module.remoteConfigDefaults).toEqual({
            [`enable_ssl_pinning_${id}_rpc`]: false,
        })
        expect(module.pinnedHosts?.().flag).toBe(`enable_ssl_pinning_${id}_rpc`)
    })

    it('registers its descriptor, adapters and defaults through the setup', () => {
        const chains = createChainRegistry()

        registerChainSetup(
            [{ chainId: id, enabled: true, module, endpoints: {} }],
            chains,
            () => context,
        )

        expect(chains.get(id).descriptor).toBe(chain.descriptor)
        expect(chains.capabilities(id)).toEqual(module.capabilityDefaults)
        expect(chains.supports(id, 'contractDecoding')).toBe(true)
        expect(chains.supports(id, 'assetInbox')).toBe(false)
        expect(addressCodecs.get(id).chainId).toBe(id)
        expect(keyDerivations.get(id).chainId).toBe(id)
        expect(accountsChainAdapters.get(id).chainId).toBe(id)
        expect(transactionPlanners.get(id).chainId).toBe(id)
        expect(transactionReviewers.get(id).chainId).toBe(id)
        expect(transferChainAdapters.get(id).chainId).toBe(id)
        expect(historyChainAdapters.get(id).chainId).toBe(id)
        expect(
            chains.byCaip2(`eip155:${eip155IdOf(chain, 'testnet')}`),
        ).toMatchObject({ chainId: id, network: { tier: 'testnet' } })
    })
})

describe('every EVM module together', () => {
    it('registers side by side with one ethereum: deeplink adapter', () => {
        deeplinkAdapters.reset()
        addressCodecs.reset()
        const chains = createChainRegistry()

        expect(() =>
            registerChainSetup(
                EVM_TEST_CHAINS.map(chain => ({
                    chainId: chain.row.id,
                    enabled: true,
                    module: evmChainModules[chain.row.id],
                    endpoints: {},
                })),
                chains,
                () => context,
            ),
        ).not.toThrow()
        expect(addressCodecs.list().map(codec => codec.chainId)).toEqual(
            EVM_TEST_CHAINS.map(chain => chain.row.id),
        )
        expect(deeplinkAdapters.list().map(adapter => adapter.chainId)).toEqual(
            ['ethereum'],
        )
    })
})

describe('the onramp capability', () => {
    it.each(['developer', 'developer-override'] as const)(
        'is off in %s mode, even where remote config switches it on',
        mode => {
            const chains = createChainRegistry()
            const module = evmChainModules.ethereum
            chains.register(
                module.descriptor,
                module.capabilityDefaults,
                module.capabilityRestrictions,
            )
            chains.setCapabilityOverrides(() => ({
                remote: { ethereum: { onramp: true } },
                chainMode: { ethereum: mode },
            }))

            expect(chains.capabilities('ethereum').onramp).toBe(false)
        },
    )
})

describe('a row override', () => {
    const overridden = createEvmChainModule(
        createEvmChain({
            ...BASE.row,
            capabilities: { nft: false },
            restrictions: { pricing: ['developer'] },
        }),
    )
    const registryWithOverride = () => {
        const chains = createChainRegistry()
        for (const module of [overridden, evmChainModules.ethereum]) {
            chains.register(
                module.descriptor,
                module.capabilityDefaults,
                module.capabilityRestrictions,
            )
        }
        return chains
    }

    it('switches a capability off for its own chain only', () => {
        const chains = registryWithOverride()

        expect(chains.capabilities('base').nft).toBe(false)
        expect(chains.capabilities('base').send).toBe(true)
        expect(chains.capabilities('ethereum').nft).toBe(true)
        expect(evmCapabilityDefaults.nft).toBe(true)
        expect(evmCapabilityDefaults.discover).toBe(false)
    })

    it('restricts a capability for its own chain only', () => {
        const chains = registryWithOverride()

        chains.setCapabilityOverrides(() => ({
            chainMode: { base: 'developer', ethereum: 'developer' },
        }))

        expect(chains.capabilities('base').pricing).toBe(false)
        expect(chains.capabilities('ethereum').pricing).toBe(true)
    })

    it('keeps the shared onramp restriction beside a row restriction', () => {
        expect(overridden.capabilityRestrictions).toEqual({
            onramp: ['developer', 'developer-override'],
            pricing: ['developer'],
        })
    })

    it('supports a capability its row switches on, for its own chain only', () => {
        const withStaking = createEvmChainModule(
            createEvmChain({ ...BASE.row, capabilities: { staking: true } }),
        )

        expect(withStaking.supportedCapabilities).toContain('staking')
        expect(evmChainModules.ethereum.supportedCapabilities).not.toContain(
            'staking',
        )
    })

    it('keeps the shared defaults for a row without overrides', () => {
        expect(evmChainModules.bsc.capabilityDefaults).toBe(
            evmCapabilityDefaults,
        )
        expect(evmChainModules.bsc.supportedCapabilities).toBe(
            evmChainModules.ethereum.supportedCapabilities,
        )
        expect(evmChainModules.bsc.capabilityRestrictions).toEqual({
            onramp: ['developer', 'developer-override'],
        })
    })
})
