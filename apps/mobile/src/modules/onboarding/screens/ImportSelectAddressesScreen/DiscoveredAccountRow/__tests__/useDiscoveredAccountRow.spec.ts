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
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    useAccountHoldingSources,
    useAccountValueTotalsQuery,
    useRegisteredChainIds,
    type LocalAccount,
} from '@perawallet/wallet-core-accounts'
import { useDiscoveredAccountRow } from '../useDiscoveredAccountRow'

const state = vi.hoisted(() => ({
    switchedOff: [] as string[],
}))

vi.mock('@hooks/useLanguage')
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
    useSwitchedOffChainIds: () => state.switchedOff,
}))
vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-contract')
    >()),
    isTestTierScope: () => false,
    addressCodecs: {
        has: () => true,
        get: () => ({
            truncate: (address: string) => `${address.slice(0, 4)}…`,
        }),
    },
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: {} }),
}))

const scopeOf = (chainId: string) => ({ chainId, networkId: 'mainnet' })

const ALGO_ADDRESS = 'ALGOADDRESS'
const EVM_ADDRESS = '0xEVMADDRESS'

const account = (chains: LocalAccount['chains']): LocalAccount =>
    ({
        id: 'candidate',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 0 },
        },
        chains,
    }) as LocalAccount

const linked = account({
    algorand: { address: ALGO_ADDRESS, keyPairId: 'k-a' },
    ethereum: { address: EVM_ADDRESS, keyPairId: 'k-e' },
    base: { address: EVM_ADDRESS, keyPairId: 'k-e' },
})

describe('useDiscoveredAccountRow', () => {
    beforeEach(() => {
        state.switchedOff = []
        vi.mocked(useRegisteredChainIds).mockReturnValue([
            'algorand',
            'ethereum',
            'base',
        ])
    })

    it('titles the row with the account number', () => {
        const { result } = renderHook(() => useDiscoveredAccountRow(linked))

        expect(result.current.title).toBe('account_info.account_number')
        expect(result.current.testAddress).toBe(ALGO_ADDRESS)
    })

    it('groups the chains that share an address, in registry order', () => {
        const { result } = renderHook(() => useDiscoveredAccountRow(linked))

        expect(result.current.addressLines).toEqual([
            {
                address: ALGO_ADDRESS,
                displayAddress: 'ALGO…',
                chainIds: ['algorand'],
            },
            {
                address: EVM_ADDRESS,
                displayAddress: '0xEV…',
                chainIds: ['ethereum', 'base'],
            },
        ])
    })

    it('leaves out a switched-off chain', () => {
        state.switchedOff = ['ethereum', 'base']

        const { result } = renderHook(() => useDiscoveredAccountRow(linked))

        expect(result.current.addressLines.map(line => line.address)).toEqual([
            ALGO_ADDRESS,
        ])
    })

    it('totals the holdings across chains in the preferred currency', () => {
        vi.mocked(useAccountHoldingSources).mockReturnValue([
            { address: ALGO_ADDRESS, scope: scopeOf('algorand') },
            { address: EVM_ADDRESS, scope: scopeOf('ethereum') },
            { address: EVM_ADDRESS, scope: scopeOf('base') },
        ] as never)
        vi.mocked(useAccountValueTotalsQuery).mockReturnValue({
            accountValueTotals: new Map([
                [
                    `algorand|${ALGO_ADDRESS}`,
                    { nativeValue: new Decimal(1), fiatValue: new Decimal(10) },
                ],
                [
                    `ethereum|${EVM_ADDRESS}`,
                    { nativeValue: new Decimal(1), fiatValue: new Decimal(5) },
                ],
                [
                    `base|${EVM_ADDRESS}`,
                    { nativeValue: new Decimal(0), fiatValue: new Decimal(2) },
                ],
            ]),
        } as never)

        const { result } = renderHook(() => useDiscoveredAccountRow(linked))

        expect(result.current.total).toEqual({
            kind: 'fiat',
            value: new Decimal(17),
        })
    })
})
