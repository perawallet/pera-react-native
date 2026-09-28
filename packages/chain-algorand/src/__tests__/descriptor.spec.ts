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
import { nativeAssetDecimals } from '@perawallet/wallet-core-chain-contract'
import { descriptorContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import { getChainConfig } from '@perawallet/wallet-core-config'
import { chainModule } from '..'

const { descriptor, capabilityDefaults } = chainModule

descriptorContractTests(descriptor, capabilityDefaults)

describe('algorand descriptor', () => {
    it.each(['mainnet', 'testnet', 'betanet'])(
        '%s matches the configured genesis and derives its CAIP-2 id from it',
        networkId => {
            const network = descriptor.networks.find(n => n.id === networkId)
            const { genesisId, genesisHash } = getChainConfig({
                chainId: 'algorand',
                networkId,
            })
            const reference = genesisHash
                .replaceAll('+', '-')
                .replaceAll('/', '_')
                .slice(0, 32)

            expect(network?.nativeRef).toEqual({
                kind: 'algorand',
                genesisId,
                genesisHash,
            })
            expect(network?.caip2).toBe(`algorand:${reference}`)
        },
    )

    it('makes mainnet and testnet the tier defaults, not betanet', () => {
        expect(
            descriptor.networks.map(n => [n.id, n.tier, n.isDefaultForTier]),
        ).toEqual([
            ['mainnet', 'mainnet', true],
            ['testnet', 'testnet', true],
            ['betanet', 'testnet', false],
        ])
    })

    it('derives ed25519 keys on the Algorand BIP-44 path and Falcon keys on none', () => {
        expect(descriptor.signing.derivationPaths.ed25519?.(3, 7)).toBe(
            "m/44'/283'/3'/0/7",
        )
        expect(
            descriptor.signing.derivationPaths['falcon-1024'],
        ).toBeUndefined()
    })

    it('builds explorer links from the configured base', () => {
        expect(descriptor.explorer.transactionUrl('mainnet', 'X')).toBe(
            'https://explorer.perawallet.app/tx/X',
        )
        expect(descriptor.explorer.accountUrl('testnet', 'A')).toBe(
            'https://testnet.explorer.perawallet.app/address/A',
        )
        expect(descriptor.explorer.assetUrl('mainnet', '31566704')).toBe(
            'https://explorer.perawallet.app/asset/31566704',
        )
    })

    it('has no explorer link for a network outside the descriptor', () => {
        expect(descriptor.explorer.accountUrl('custom', 'A')).toBeUndefined()
    })

    it('agrees with nativeAssetDecimals', () => {
        expect(nativeAssetDecimals('algorand')).toBe(
            descriptor.nativeAsset.decimals,
        )
    })
})
