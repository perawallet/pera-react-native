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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    chainAddressCopyValue,
    displayChainOption,
} from '../chainOptionDisplay'

vi.mock('@perawallet/wallet-core-chain-contract', () => ({
    addressCodecs: {
        get: (chainId: string) => ({
            truncate: (address: string) => `${chainId}:${address}`,
            isValid: (address: string) => address.startsWith('0x'),
            normalize: (address: string) => address.toUpperCase(),
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ ethereum: 'Ethereum' })[chainId],
}))

describe('displayChainOption', () => {
    it("names the chain and truncates the address with the chain's codec", () => {
        expect(
            displayChainOption({
                chainId: 'ethereum' as ChainId,
                isEnabled: true,
                address: '0xabc',
            }),
        ).toEqual({
            chainId: 'ethereum',
            isEnabled: true,
            displayName: 'Ethereum',
            address: 'ethereum:0xabc',
        })
    })

    it('falls back to the chain id and leaves a missing address unset', () => {
        expect(
            displayChainOption({
                chainId: 'unknown' as ChainId,
                isEnabled: false,
            }),
        ).toEqual({
            chainId: 'unknown',
            isEnabled: false,
            displayName: 'unknown',
            address: undefined,
        })
    })
})

describe('chainAddressCopyValue', () => {
    it("normalizes an address the chain's codec parses", () => {
        expect(chainAddressCopyValue('ethereum' as ChainId, '0xabc')).toBe(
            '0XABC',
        )
    })

    it('copies an address the codec rejects as stored, rather than throwing', () => {
        expect(chainAddressCopyValue('ethereum' as ChainId, 'junk')).toBe(
            'junk',
        )
    })
})
