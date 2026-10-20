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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    eip155ChainIdOf,
    eip155ChainIdOfNetwork,
    fromCaip19,
    InvalidCaip19Error,
    networkIdOf,
    toCaip19,
    UnknownEvmNetworkError,
} from '../caip19'
import {
    BASE,
    ETHEREUM,
    EVM_TEST_CHAINS,
    evmChainOf,
    evmScopeOf,
} from '../../../__tests__/evm-chains'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_CAIP19 = 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

describe('eip155ChainIdOf', () => {
    it("reads the scope network's EIP-155 id from the descriptor", () => {
        expect(eip155ChainIdOf(MAINNET, ETHEREUM)).toBe(1)
        expect(eip155ChainIdOf(SEPOLIA, ETHEREUM)).toBe(11_155_111)
    })

    it('rejects a network the descriptor does not list', () => {
        expect(() =>
            eip155ChainIdOf(
                { chainId: 'ethereum', networkId: 'holesky' },
                ETHEREUM,
            ),
        ).toThrow(UnknownEvmNetworkError)
    })

    it('rejects a scope on another chain', () => {
        expect(() =>
            eip155ChainIdOf(
                { chainId: 'algorand', networkId: 'mainnet' },
                ETHEREUM,
            ),
        ).toThrow(UnknownEvmNetworkError)
    })
})

describe('eip155ChainIdOfNetwork', () => {
    it.each([
        ['mainnet', 1],
        ['sepolia', 11_155_111],
        ['holesky', undefined],
        [undefined, undefined],
    ])('maps %s to %s', (networkId, expected) => {
        expect(eip155ChainIdOfNetwork(ETHEREUM, networkId)).toBe(expected)
    })
})

describe('networkIdOf', () => {
    it.each([
        [1, 'mainnet'],
        [11_155_111, 'sepolia'],
        [137, undefined],
    ])('maps %s to %s', (eip155ChainId, expected) => {
        expect(networkIdOf(ETHEREUM, eip155ChainId)).toBe(expected)
    })
})

describe('toCaip19', () => {
    it('writes an ERC-20 with a lowercase address on the scope chain', () => {
        expect(toCaip19(USDC, MAINNET, ETHEREUM)).toBe(USDC_CAIP19)
        expect(toCaip19(USDC, SEPOLIA, ETHEREUM)).toBe(
            'eip155:11155111/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        )
    })

    it('writes the native coin as slip44:60', () => {
        expect(toCaip19('native', MAINNET, ETHEREUM)).toBe('eip155:1/slip44:60')
    })

    it('rejects an id that is not an address', () => {
        expect(() => toCaip19('not-an-address', MAINNET, ETHEREUM)).toThrow()
    })
})

describe('fromCaip19', () => {
    it('reads an ERC-20 back as its checksummed address', () => {
        expect(fromCaip19(USDC_CAIP19, MAINNET, ETHEREUM)).toBe(USDC)
    })

    it('reads slip44:60 back as the native id', () => {
        expect(fromCaip19('eip155:1/slip44:60', MAINNET, ETHEREUM)).toBe(
            'native',
        )
    })

    it.each([
        ['another chain', `eip155:5/erc20:${USDC.toLowerCase()}`],
        ['another namespace', 'algorand:mainnet/asa:31566704'],
        ['another slip44 coin', 'eip155:1/slip44:0'],
        ['another asset standard', `eip155:1/erc721:${USDC.toLowerCase()}`],
        ['a malformed address', 'eip155:1/erc20:0x1234'],
        ['a non-CAIP string', USDC],
    ])('rejects %s', (_, caip19) => {
        expect(() => fromCaip19(caip19, MAINNET, ETHEREUM)).toThrow(
            InvalidCaip19Error,
        )
    })

    it('round-trips through toCaip19', () => {
        expect(
            fromCaip19(toCaip19(USDC, SEPOLIA, ETHEREUM), SEPOLIA, ETHEREUM),
        ).toBe(USDC)
    })
})

describe('native CAIP-19 ids per chain', () => {
    // The backend's native_asset_id for each chain's mainnet.
    it.each([
        ['ethereum', 'eip155:1/slip44:60'],
        ['base', 'eip155:8453/slip44:60'],
        ['bsc', 'eip155:56/slip44:714'],
        ['arbitrum', 'eip155:42161/slip44:60'],
        ['avalanche', 'eip155:43114/slip44:9000'],
        ['polygon', 'eip155:137/slip44:966'],
    ] as const)('names %s native as %s', (chainId, caip19) => {
        const chain = evmChainOf(chainId)
        const scope = evmScopeOf(chain)

        expect(toCaip19(chain.nativeAsset.assetId, scope, chain)).toBe(caip19)
        expect(fromCaip19(caip19, scope, chain)).toBe(chain.nativeAsset.assetId)
    })

    it.each(EVM_TEST_CHAINS)(
        'round-trips an ERC-20 on $row.id testnet',
        chain => {
            const scope = evmScopeOf(chain, 'testnet')

            expect(fromCaip19(toCaip19(USDC, scope, chain), scope, chain)).toBe(
                USDC,
            )
        },
    )

    it("rejects another chain's native coin", () => {
        const bsc = evmChainOf('bsc')

        expect(() =>
            fromCaip19('eip155:56/slip44:60', evmScopeOf(bsc), bsc),
        ).toThrow(InvalidCaip19Error)
    })

    it("refuses a scope that isn't the chain's", () => {
        expect(() => eip155ChainIdOf(MAINNET, BASE)).toThrow(
            UnknownEvmNetworkError,
        )
        expect(eip155ChainIdOf(evmScopeOf(BASE, 'testnet'), BASE)).toBe(84_532)
    })
})
