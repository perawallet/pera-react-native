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
    fromCaip19,
    InvalidCaip19Error,
    toCaip19,
    UnknownEvmNetworkError,
} from '../caip19'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_CAIP19 = 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

describe('eip155ChainIdOf', () => {
    it("reads the scope network's EIP-155 id from the descriptor", () => {
        expect(eip155ChainIdOf(MAINNET)).toBe(1)
        expect(eip155ChainIdOf(SEPOLIA)).toBe(11_155_111)
    })

    it('rejects a network the descriptor does not list', () => {
        expect(() =>
            eip155ChainIdOf({ chainId: 'ethereum', networkId: 'holesky' }),
        ).toThrow(UnknownEvmNetworkError)
    })

    it('rejects a scope on another chain', () => {
        expect(() =>
            eip155ChainIdOf({ chainId: 'algorand', networkId: 'mainnet' }),
        ).toThrow(UnknownEvmNetworkError)
    })
})

describe('toCaip19', () => {
    it('writes an ERC-20 with a lowercase address on the scope chain', () => {
        expect(toCaip19(USDC, MAINNET)).toBe(USDC_CAIP19)
        expect(toCaip19(USDC, SEPOLIA)).toBe(
            'eip155:11155111/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        )
    })

    it('writes the native coin as slip44:60', () => {
        expect(toCaip19('native', MAINNET)).toBe('eip155:1/slip44:60')
    })

    it('rejects an id that is not an address', () => {
        expect(() => toCaip19('not-an-address', MAINNET)).toThrow()
    })
})

describe('fromCaip19', () => {
    it('reads an ERC-20 back as its checksummed address', () => {
        expect(fromCaip19(USDC_CAIP19, MAINNET)).toBe(USDC)
    })

    it('reads slip44:60 back as the native id', () => {
        expect(fromCaip19('eip155:1/slip44:60', MAINNET)).toBe('native')
    })

    it.each([
        ['another chain', `eip155:5/erc20:${USDC.toLowerCase()}`],
        ['another namespace', 'algorand:mainnet/asa:31566704'],
        ['another slip44 coin', 'eip155:1/slip44:0'],
        ['another asset standard', `eip155:1/erc721:${USDC.toLowerCase()}`],
        ['a malformed address', 'eip155:1/erc20:0x1234'],
        ['a non-CAIP string', USDC],
    ])('rejects %s', (_, caip19) => {
        expect(() => fromCaip19(caip19, MAINNET)).toThrow(InvalidCaip19Error)
    })

    it('round-trips through toCaip19', () => {
        expect(fromCaip19(toCaip19(USDC, SEPOLIA), SEPOLIA)).toBe(USDC)
    })
})
