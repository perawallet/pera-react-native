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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mockRequiresBackup = vi.fn()
vi.mock('../useRequiresMnemonicBackup', () => ({
    useRequiresMnemonicBackup: (...args: unknown[]) =>
        mockRequiresBackup(...args),
}))

const mockFundedNetworks = vi.fn()
const mockAccountsDelegatedTo = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountFundedNetworksQuery: (...args: unknown[]) =>
            mockFundedNetworks(...args),
        useAccountsDelegatedTo: (...args: unknown[]) =>
            mockAccountsDelegatedTo(...args),
    }
})

const mockCanBackUpMnemonic = vi.fn()
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-chain-shared')
        >()
    return {
        ...original,
        useChainCapability: (...args: unknown[]) =>
            mockCanBackUpMnemonic(...args),
    }
})

import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import { useMnemonicBackupStore } from '../../store'
import { useShouldPromptMnemonicBackup } from '../useShouldPromptMnemonicBackup'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const ETHEREUM_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const accountOnEthereum: WalletAccount = {
    id: 'evm-account',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { ethereum: { address: '0xE1', keyPairId: 'kp-evm' } },
}

const accountHD: WalletAccount = {
    id: 'hd-account',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: 'HD1', keyPairId: 'kp' } },
}

const fundedOn = (...networks: string[]) => ({
    fundedNetworks: networks,
    isFunded: networks.length > 0,
    isPending: false,
    isError: false,
})

describe('useShouldPromptMnemonicBackup', () => {
    beforeEach(() => {
        registerFakeBackupAdapter()
        mockRequiresBackup.mockReset()
        mockFundedNetworks.mockReset()
        mockAccountsDelegatedTo.mockReset()
        mockAccountsDelegatedTo.mockReturnValue([])
        mockCanBackUpMnemonic.mockReset()
        mockCanBackUpMnemonic.mockReturnValue(true)
        useMnemonicBackupStore.getState().resetState()
    })

    const useRealRequiresBackup = async () => {
        const { useRequiresMnemonicBackup } = await vi.importActual<
            typeof import('../useRequiresMnemonicBackup')
        >('../useRequiresMnemonicBackup')
        mockRequiresBackup.mockImplementation(useRequiresMnemonicBackup)
    }

    test('false when the chain has mnemonic backup off, however funded', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))
        mockCanBackUpMnemonic.mockReturnValue(false)

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(false)
        expect(mockCanBackUpMnemonic).toHaveBeenCalledWith(
            'algorand',
            'mnemonicBackup',
        )
    })

    test('false when the account does not require backup', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(false)
    })

    test('false when the account is unfunded and signs for nothing', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn())

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(false)
    })

    test('true when the only funded network is not the active one', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn('testnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(true)
    })

    test('true when the account requires backup and has balance > 0', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(true)
    })

    test("true when an unfunded account is another account's rekey target", () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn())
        mockAccountsDelegatedTo.mockReturnValue([
            {
                id: 'a',
                custody: { kind: 'local', seed: null },
                chains: { algorand: { address: 'A' } },
            },
        ])

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(true)
        expect(mockAccountsDelegatedTo).toHaveBeenCalledWith('HD1', 'algorand')
    })

    test('false for a rekey target that no longer needs backup', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockFundedNetworks.mockReturnValue(fundedOn())
        mockAccountsDelegatedTo.mockReturnValue([
            {
                id: 'a',
                custody: { kind: 'local', seed: null },
                chains: { algorand: { address: 'A' } },
            },
        ])

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(false)
    })

    test('false and skips lookups for an undefined account', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockFundedNetworks.mockReturnValue(fundedOn())

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(undefined, SCOPE),
        )
        expect(result.current).toBe(false)
        expect(mockFundedNetworks).toHaveBeenCalledWith(undefined, SCOPE)
        expect(mockAccountsDelegatedTo).toHaveBeenCalledWith(
            undefined,
            'algorand',
        )
    })

    test('false, and reads no backup adapter, on a chain with mnemonic backup off', async () => {
        await useRealRequiresBackup()
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))
        mockCanBackUpMnemonic.mockReturnValue(false)

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountOnEthereum, ETHEREUM_SCOPE),
        )
        expect(result.current).toBe(false)
        expect(mockRequiresBackup).toHaveBeenCalledWith(undefined, 'ethereum')
        expect(mockFundedNetworks).toHaveBeenCalledWith(
            undefined,
            ETHEREUM_SCOPE,
        )
        expect(mockAccountsDelegatedTo).toHaveBeenCalledWith(
            undefined,
            'ethereum',
        )
    })

    test('false, without throwing, when the capability is on but the chain registers no backup adapter', async () => {
        await useRealRequiresBackup()
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountOnEthereum, ETHEREUM_SCOPE),
        )
        expect(result.current).toBe(false)
    })

    test('prompts a funded, never-backed-up Algorand account through the real backup state', async () => {
        await useRealRequiresBackup()
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD, SCOPE),
        )
        expect(result.current).toBe(true)
    })
})
