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
import { ethereumModule } from '..'

const { descriptor, capabilityDefaults } = ethereumModule

descriptorContractTests(descriptor, capabilityDefaults)

describe('ethereum descriptor', () => {
    it('lists mainnet and sepolia only, each the default of its tier', () => {
        expect(
            descriptor.networks.map(n => [
                n.id,
                n.tier,
                n.isDefaultForTier,
                n.caip2,
                n.nativeRef,
            ]),
        ).toEqual([
            [
                'mainnet',
                'mainnet',
                true,
                'eip155:1',
                { kind: 'evm', eip155ChainId: 1 },
            ],
            [
                'sepolia',
                'testnet',
                true,
                'eip155:11155111',
                { kind: 'evm', eip155ChainId: 11155111 },
            ],
        ])
    })

    it('derives secp256k1 keys on the Ethereum BIP-44 path', () => {
        expect(descriptor.signing.schemes).toEqual(['secp256k1'])
        expect(descriptor.signing.derivationPaths.secp256k1?.(0, 1)).toBe(
            "m/44'/60'/0'/0/1",
        )
    })

    it('agrees with the contract on the native asset decimals', () => {
        expect(nativeAssetDecimals('ethereum')).toBe(
            descriptor.nativeAsset.decimals,
        )
        expect(descriptor.nativeAsset.decimals).toBe(18)
    })

    it('states the account-model protocol facts', () => {
        expect(descriptor.protocol).toEqual({
            feeModel: 'gas',
            hasAccountNonce: true,
            requiresAssetOptIn: false,
            hasMinimumBalance: false,
            supportsAtomicGroups: false,
            supportsReplacement: true,
            supportsNativeMultisig: false,
            supportsRekey: false,
            hasTokenApproval: true,
            multipleAddressesPerAccount: false,
        })
    })

    it('builds Etherscan links for both networks', () => {
        expect(descriptor.explorer.accountUrl('mainnet', '0xA')).toBe(
            'https://etherscan.io/address/0xA',
        )
        expect(descriptor.explorer.transactionUrl('sepolia', '0xT')).toBe(
            'https://sepolia.etherscan.io/tx/0xT',
        )
        expect(descriptor.explorer.assetUrl('mainnet', '0xC')).toBe(
            'https://etherscan.io/token/0xC',
        )
    })

    it('has no explorer link for the native asset or an unlisted network', () => {
        expect(
            descriptor.explorer.assetUrl('mainnet', 'native'),
        ).toBeUndefined()
        expect(descriptor.explorer.accountUrl('goerli', '0xA')).toBeUndefined()
        expect(
            descriptor.explorer.transactionUrl('custom', '0xT'),
        ).toBeUndefined()
    })
})
