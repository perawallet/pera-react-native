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

// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapAccountsAddresses } from '../useSwapAccountsAddresses'

vi.mock('../../chain-adapter', () => ({
    isSwapChain: (chainId: string) =>
        chainId === 'algorand' || chainId === 'ethereum',
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    deploymentOf: () => 'mainnet',
}))

const registration = vi.hoisted(() => ({ isV4: false }))

// Like v3, which registers only Algorand; v4 also sends Ethereum.
vi.mock('@perawallet/wallet-core-device', () => ({
    isSentInDeviceRegistration: (
        _account: unknown,
        chainId: string,
        _deployment: string,
        isV4: boolean,
    ) => chainId === 'algorand' || isV4,
    useIsDeviceRegistrationV4Enabled: () => registration.isV4,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScopes: (chainIds: string[]) =>
        chainIds.map(chainId => ({ chainId, networkId: 'mainnet' })),
}))

const account = (
    id: string,
    chains: WalletAccount['chains'],
): WalletAccount => ({
    id,
    name: '',
    custody: { kind: 'local', seed: null },
    chains,
})

describe('swaps/useSwapAccountsAddresses', () => {
    test('lists each account on each swap chain it has an address on, tagged with the account', () => {
        const both = account('both', {
            algorand: { address: 'ALGO_ADDR', keyPairId: 'k1' },
            ethereum: { address: '0xETH', keyPairId: 'k2' },
        })
        const algorandOnly = account('algo', {
            algorand: { address: 'OTHER', keyPairId: 'k3' },
        })

        const { result } = renderHook(() =>
            useSwapAccountsAddresses([both, algorandOnly]),
        )

        expect(
            result.current.map(({ accountId, address, scope }) => [
                accountId,
                address,
                scope.chainId,
            ]),
        ).toEqual([
            ['both', 'ALGO_ADDR', 'algorand'],
            ['both', '0xETH', 'ethereum'],
            ['algo', 'OTHER', 'algorand'],
        ])
    })

    test('marks the addresses device registration sends', () => {
        const both = account('both', {
            algorand: { address: 'ALGO_ADDR', keyPairId: 'k1' },
            ethereum: { address: '0xETH', keyPairId: 'k2' },
        })

        const { result } = renderHook(() => useSwapAccountsAddresses([both]))

        expect(
            result.current.map(({ address, isOnDevice }) => [
                address,
                isOnDevice,
            ]),
        ).toEqual([
            ['ALGO_ADDR', true],
            ['0xETH', false],
        ])
    })

    test('marks the addresses again when the registration API flips', () => {
        const both = account('both', {
            algorand: { address: 'ALGO_ADDR', keyPairId: 'k1' },
            ethereum: { address: '0xETH', keyPairId: 'k2' },
        })
        const accounts = [both]
        const { result, rerender } = renderHook(() =>
            useSwapAccountsAddresses(accounts),
        )
        expect(result.current.map(entry => entry.isOnDevice)).toEqual([
            true,
            false,
        ])

        registration.isV4 = true
        rerender()

        expect(result.current.map(entry => entry.isOnDevice)).toEqual([
            true,
            true,
        ])
        registration.isV4 = false
    })

    test('lists nothing without accounts', () => {
        const { result } = renderHook(() => useSwapAccountsAddresses([]))

        expect(result.current).toEqual([])
    })
})
