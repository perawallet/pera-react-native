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
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
} from '../../models/capabilities'
import type { ChainDescriptor } from '../../models/descriptor'
import type { ChainNetwork } from '../../models/identity'
import {
    descriptorContractTests,
    descriptorContractViolations,
} from '../descriptor-contract'

const network = (
    overrides: Partial<ChainNetwork> & Pick<ChainNetwork, 'id'>,
): ChainNetwork => ({
    tier: 'mainnet',
    displayName: overrides.id,
    isDefaultForTier: false,
    caip2: `algorand:${overrides.id}`,
    nativeRef: {
        kind: 'algorand',
        genesisId: overrides.id,
        genesisHash: 'AA==',
    },
    status: 'active',
    ...overrides,
})

const EXPLORER_BASE: Partial<Record<string, string>> = {
    mainnet: 'https://explorer.example',
    testnet: 'https://testnet.explorer.example',
    betanet: 'https://betanet.explorer.example',
}

const explorerUrl = (networkId: string, path: string): string | undefined => {
    const base = EXPLORER_BASE[networkId]
    return base ? `${base}/${path}` : undefined
}

const fixture: ChainDescriptor = {
    id: 'algorand',
    family: 'algorand',
    displayName: 'Algorand',
    networks: [
        network({ id: 'mainnet', tier: 'mainnet', isDefaultForTier: true }),
        network({ id: 'testnet', tier: 'testnet', isDefaultForTier: true }),
        network({ id: 'betanet', tier: 'testnet' }),
        network({ id: 'custom', tier: 'testnet', caip2: undefined }),
    ],
    nativeAsset: {
        ref: { chainId: 'algorand', assetId: '0' },
        symbol: 'ALGO',
        name: 'Algo',
        decimals: 6,
    },
    signing: {
        schemes: ['ed25519'],
        derivationPaths: {
            ed25519: (account, keyIndex) =>
                `m/44'/283'/${account}'/0'/${keyIndex}'`,
        },
    },
    protocol: {
        feeModel: 'flat',
        hasAccountNonce: false,
        requiresAssetOptIn: true,
        hasMinimumBalance: true,
        supportsAtomicGroups: true,
        supportsReplacement: false,
        supportsNativeMultisig: true,
        supportsRekey: true,
        multipleAddressesPerAccount: false,
    },
    explorer: {
        accountUrl: (networkId, address) =>
            explorerUrl(networkId, `account/${address}`),
        transactionUrl: (networkId, txId) =>
            explorerUrl(networkId, `tx/${txId}`),
        assetUrl: (networkId, assetId) =>
            explorerUrl(networkId, `asset/${assetId}`),
    },
    finality: { kind: 'instant' },
}

const defaults = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const withNetworks = (networks: ChainNetwork[]): ChainDescriptor => ({
    ...fixture,
    networks,
})

descriptorContractTests(fixture, defaults)

describe('descriptorContractViolations', () => {
    it('exempts a custom network from the CAIP-2 and explorer rules', () => {
        expect(descriptorContractViolations(fixture, defaults)).toEqual([])
    })

    it('names the tier that has two defaults', () => {
        const descriptor = withNetworks(
            fixture.networks.map(n =>
                n.id === 'betanet'
                    ? { ...n, tier: 'mainnet', isDefaultForTier: true }
                    : n,
            ),
        )

        expect(descriptorContractViolations(descriptor, defaults)).toEqual([
            'tier "mainnet" has 2 default networks; expected exactly 1',
        ])
    })

    it('names the tier that has no default', () => {
        const descriptor = withNetworks(
            fixture.networks.map(n =>
                n.tier === 'testnet' ? { ...n, isDefaultForTier: false } : n,
            ),
        )

        expect(descriptorContractViolations(descriptor, defaults)).toEqual([
            'tier "testnet" has 0 default networks; expected exactly 1',
        ])
    })

    it('names a non-custom network without a CAIP-2 id', () => {
        const descriptor = withNetworks(
            fixture.networks.map(n =>
                n.id === 'betanet' ? { ...n, caip2: undefined } : n,
            ),
        )

        expect(descriptorContractViolations(descriptor, defaults)).toEqual([
            'network "betanet" has no CAIP-2 id',
        ])
    })

    it('names the explorer builder and network that return no URL', () => {
        const descriptor: ChainDescriptor = {
            ...fixture,
            explorer: {
                ...fixture.explorer,
                assetUrl: (networkId, assetId) =>
                    networkId === 'betanet'
                        ? undefined
                        : fixture.explorer.assetUrl(networkId, assetId),
            },
        }

        expect(descriptorContractViolations(descriptor, defaults)).toEqual([
            'explorer.assetUrl returned no URL for network "betanet"',
        ])
    })

    it('rejects an explorer URL that does not parse', () => {
        const descriptor: ChainDescriptor = {
            ...fixture,
            explorer: { ...fixture.explorer, accountUrl: () => 'not a url' },
        }

        expect(descriptorContractViolations(descriptor, defaults)).toEqual([
            'explorer.accountUrl returned no URL for network "mainnet"',
            'explorer.accountUrl returned no URL for network "testnet"',
            'explorer.accountUrl returned no URL for network "betanet"',
        ])
    })

    it('names a capability missing from capabilityDefaults', () => {
        const { swap: _swap, ...rest } = defaults

        expect(
            descriptorContractViolations(fixture, rest as ChainCapabilities),
        ).toEqual(['capabilityDefaults is missing "swap"'])
    })

    it('treats a non-boolean default as missing', () => {
        const partial = {
            ...defaults,
            card: 'true',
        } as unknown as ChainCapabilities

        expect(descriptorContractViolations(fixture, partial)).toEqual([
            'capabilityDefaults is missing "card"',
        ])
    })
})
