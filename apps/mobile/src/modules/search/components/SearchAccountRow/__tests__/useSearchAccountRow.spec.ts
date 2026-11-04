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
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSearchAccountRow } from '../useSearchAccountRow'

vi.mock('@hooks/useHomeChainScope', () => ({
    useHomeChainScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-contract')
    >()),
    addressCodecs: {
        has: () => true,
        get: () => ({
            truncate: (address: string) =>
                `${address.slice(0, 6)}...${address.slice(-4)}`,
        }),
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainDisplayNameOf: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
}))

const ETH_ADDRESS = '0xC3D7aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5300'

const ACCOUNT: WalletAccount = {
    id: 'eth',
    name: 'ETH',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: {
            address: 'G5EAWABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDE2WVGE',
        },
        ethereum: { address: ETH_ADDRESS },
    },
}

const render = (chainId: 'algorand' | 'ethereum' | undefined, query: string) =>
    renderHook(() => useSearchAccountRow({ account: ACCOUNT, chainId, query }))
        .result.current

describe('useSearchAccountRow', () => {
    it('shows nothing extra for a result with no chain', () => {
        expect(render(undefined, 'eth')).toEqual({
            searchedChainId: undefined,
            segments: [],
            chainName: '',
        })
    })

    it('shows nothing extra for a result on the home chain', () => {
        expect(render('algorand', 'g5eaw').searchedChainId).toBeUndefined()
    })

    it('highlights the match in the other chain address and names the network', () => {
        expect(render('ethereum', '0xc3')).toEqual({
            searchedChainId: 'ethereum',
            segments: [
                { text: '0xC3', isMatch: true },
                { text: 'D7...5300', isMatch: false },
            ],
            chainName: 'Ethereum',
        })
    })

    it('shows the address unmarked when only the network name matched', () => {
        expect(render('ethereum', 'ethereum').segments).toEqual([
            { text: '0xC3D7...5300', isMatch: false },
        ])
    })
})
