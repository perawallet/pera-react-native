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
import { descriptorContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import { evmCapabilityDefaults } from '../../capability-defaults'
import { createEvmChain } from '../create-evm-chain'
import {
    ETHEREUM_CHAIN_ID,
    EVM_CHAIN_ROWS,
    EVM_CHAINS,
    evmChainOf,
    evmChainOfEip155Id,
} from '../table'
import { ETHEREUM_NATIVE_ASSET } from '../..'

for (const chain of EVM_CHAINS) {
    descriptorContractTests(chain.descriptor, evmCapabilityDefaults)
}

describe('the EVM chain table', () => {
    it('starts with Ethereum and lists each chain once', () => {
        const ids = EVM_CHAIN_ROWS.map(row => row.id)

        expect(ids[0]).toBe(ETHEREUM_CHAIN_ID)
        expect(ids).toEqual([
            'ethereum',
            'base',
            'bsc',
            'arbitrum',
            'avalanche',
            'polygon',
        ])
    })

    it("keeps Ethereum's descriptor values", () => {
        const { descriptor } = evmChainOf('ethereum')

        expect(descriptor.displayName).toBe('Ethereum')
        expect(descriptor.nativeAsset).toEqual({
            ref: { chainId: 'ethereum', assetId: 'native' },
            symbol: 'ETH',
            name: 'Ether',
            decimals: 18,
        })
        expect(descriptor.finality).toEqual({
            kind: 'confirmations',
            recommended: 12,
        })
        expect(descriptor.uriSchemes).toEqual(['ethereum'])
        expect(descriptor.explorer.transactionUrl('sepolia', '0xT')).toBe(
            'https://sepolia.etherscan.io/tx/0xT',
        )
    })

    it.each([
        ['base', 'ETH', 'https://basescan.org/address/0xA'],
        ['bsc', 'BNB', 'https://bscscan.com/address/0xA'],
        ['arbitrum', 'ETH', 'https://arbiscan.io/address/0xA'],
        ['avalanche', 'AVAX', 'https://snowtrace.io/address/0xA'],
        ['polygon', 'POL', 'https://polygonscan.com/address/0xA'],
    ] as const)(
        'gives %s its own native coin %s and explorer',
        (id, symbol, accountUrl) => {
            const { descriptor, nativeAsset } = evmChainOf(id)

            expect(descriptor.family).toBe('evm')
            expect(descriptor.nativeAsset.symbol).toBe(symbol)
            expect(descriptor.nativeAsset.ref).toEqual({
                chainId: id,
                assetId: 'native',
            })
            expect(nativeAsset.unitName).toBe(symbol)
            expect(descriptor.explorer.accountUrl('mainnet', '0xA')).toBe(
                accountUrl,
            )
            expect(descriptor.explorer.assetUrl('mainnet', 'native')).toBe(
                undefined,
            )
        },
    )

    it("gives the native coin the explorer's front page, and none on a network with no explorer", () => {
        const { explorer } = evmChainOf('ethereum').descriptor

        expect(explorer.homeUrl?.('mainnet')).toBe('https://etherscan.io')
        expect(explorer.homeUrl?.('custom')).toBeUndefined()
    })

    it('builds each chain once, so its native asset keeps one identity', () => {
        expect(evmChainOf('base')).toBe(evmChainOf('base'))
        expect(evmChainOf('ethereum').nativeAsset).toBe(
            evmChainOf('ethereum').nativeAsset,
        )
        expect(ETHEREUM_NATIVE_ASSET).toBe(evmChainOf('ethereum').nativeAsset)
        expect(createEvmChain(EVM_CHAIN_ROWS[0]!).nativeAsset).not.toBe(
            ETHEREUM_NATIVE_ASSET,
        )
    })

    it('enables Ethereum alone by default', () => {
        const defaults = EVM_CHAINS.filter(
            ({ descriptor }) => descriptor.enabledByDefault,
        ).map(({ row }) => row.id)

        expect(defaults).toEqual([ETHEREUM_CHAIN_ID])
    })

    it('derives every chain on the Ethereum BIP-44 path', () => {
        for (const { descriptor } of EVM_CHAINS) {
            expect(descriptor.signing.derivationPaths.secp256k1?.(0, 1)).toBe(
                "m/44'/60'/0'/0/1",
            )
        }
    })
})

describe('evmChainOfEip155Id', () => {
    it.each([
        [1, 'ethereum', 'mainnet'],
        [8453, 'base', 'mainnet'],
        [84532, 'base', 'sepolia'],
        [56, 'bsc', 'mainnet'],
        [97, 'bsc', 'testnet'],
        [43113, 'avalanche', 'fuji'],
        [80002, 'polygon', 'amoy'],
    ])('resolves %i to %s/%s', (eip155ChainId, chainId, networkId) => {
        const owner = evmChainOfEip155Id(eip155ChainId)

        expect(owner?.chain.row.id).toBe(chainId)
        expect(owner?.networkId).toBe(networkId)
    })

    it('finds nothing for an id no chain owns', () => {
        expect(evmChainOfEip155Id(999_999)).toBeUndefined()
    })
})
