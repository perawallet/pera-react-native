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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { useAccountTypeLabel } from '@hooks/useAccountTypeLabel'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type MultiSigAccount,
    type DelegateTransition,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'
import {
    registerEthereumAccountPresentation,
    registerEthereumAccountsAdapter,
} from '@test-utils/ethereumAccountsAdapter'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import {
    accountForType,
    type AlgorandAccountKind,
} from '@test-utils/accountCustody'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (key === 'account_info.type_rekeyed_signer')
                return `Rekeyed (Signed by ${params?.to})`
            if (key === 'account_info.rekey_signer_ledger')
                return 'a Ledger account'
            if (params?.count != null) return `${key} (${params.count})`
            return key
        },
    }),
}))

const mockUseCanSignWith = vi.fn<() => boolean>()
const mockUseDelegatedTransition = vi.fn<() => DelegateTransition | null>()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useCanSignWith: () => mockUseCanSignWith(),
        useDelegatedTransition: () => mockUseDelegatedTransition(),
    }
})

const accountOfType = (type: AlgorandAccountKind): WalletAccount =>
    accountForType(type)

const rekeyedAccount: WalletAccount = {
    ...accountForType('standalone', 'REKEYED_ADDR'),
    id: 'rekeyed-account',
}

const participant = accountForType('standalone', 'A')

const multisigAccount: MultiSigAccount = {
    id: 'multisig-account',
    name: '',
    custody: { kind: 'multisig' },
    chains: {
        algorand: {
            address: 'MULTISIG_ADDR',
            native: {
                family: 'algorand',
                multisig: {
                    threshold: 2,
                    addresses: ['A', 'B', 'C'],
                    version: 1,
                },
            },
        },
    },
}

describe('useAccountTypeLabel', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        useNetworkStore.getState().setMode('live')
        useAccountChainStateStore.getState().resetState()
        seedAuthority('REKEYED_ADDR', 'AUTH_ADDR')
        vi.clearAllMocks()
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue(null)
        useAccountsStore.setState({ accounts: [] })
    })

    it('turns rekeyed when the network moves to the scope that holds the authority', () => {
        useAccountChainStateStore.getState().resetState()
        seedAuthority('REKEYED_ADDR', 'AUTH_ADDR', {
            chainId: ALGORAND_CHAIN_ID,
            networkId: 'testnet',
        } as const)
        useNetworkStore.getState().setMode('live')
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current.label).toBe('account_info.type_algo25')

        act(() => useNetworkStore.getState().setMode('developer'))

        expect(result.current.label).toBe('account_info.type_rekeyed')
    })

    it('returns an empty label when no account is provided', () => {
        const { result } = renderHook(() => useAccountTypeLabel(undefined))
        expect(result.current).toEqual({
            label: '',
            main: '',
            qualifier: null,
        })
    })

    it.each([
        ['hdWallet', 'account_info.type_universal_wallet'],
        ['standalone', 'account_info.type_algo25'],
        ['hardware', 'account_info.type_ledger'],
        ['watch', 'account_info.type_watch'],
        ['quantum', 'account_info.type_quantum'],
    ] as const)('maps non-rekeyed %s account to label %s', (type, expected) => {
        const { result } = renderHook(() =>
            useAccountTypeLabel(accountOfType(type)),
        )
        expect(result.current).toEqual({
            label: expected,
            main: expected,
            qualifier: null,
        })
    })

    it('uses a plain shared account label for a signable multisig account', () => {
        mockUseCanSignWith.mockReturnValue(true)
        useAccountsStore.setState({ accounts: [multisigAccount, participant] })
        const { result } = renderHook(() =>
            useAccountTypeLabel(multisigAccount),
        )
        expect(result.current).toEqual({
            label: 'account_info.type_multisig',
            main: 'account_info.type_multisig',
            qualifier: null,
        })
    })

    it('renders the no-auth label for a multisig account when we cannot sign', () => {
        mockUseCanSignWith.mockReturnValue(false)
        const { result } = renderHook(() =>
            useAccountTypeLabel(multisigAccount),
        )
        expect(result.current).toEqual({
            label: 'account_info.type_no_auth',
            main: 'account_info.type_no_auth',
            qualifier: null,
        })
    })

    it('splits the signer qualifier for a rekeyed signable account', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue({
            from: accountForType('watch'),
            to: accountForType('hardware'),
        })
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current).toEqual({
            label: 'Rekeyed (Signed by a Ledger account)',
            main: 'Rekeyed',
            qualifier: '(Signed by a Ledger account)',
        })
    })

    it('falls back to a plain rekeyed label when the auth account is unknown', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue(null)
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current).toEqual({
            label: 'account_info.type_rekeyed',
            main: 'account_info.type_rekeyed',
            qualifier: null,
        })
    })

    it('renders the no-auth label for a rekeyed account when we cannot sign', () => {
        mockUseCanSignWith.mockReturnValue(false)
        mockUseDelegatedTransition.mockReturnValue(null)
        const { result } = renderHook(() => useAccountTypeLabel(rekeyedAccount))
        expect(result.current).toEqual({
            label: 'account_info.type_no_auth',
            main: 'account_info.type_no_auth',
            qualifier: null,
        })
    })

    describe('an account with no Algorand entry', () => {
        const ethAccount = (
            custody: WalletAccount['custody'],
        ): WalletAccount => ({
            id: 'eth',
            name: '',
            chains: {
                ethereum: {
                    address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
                },
            },
            custody,
        })

        beforeEach(() => {
            registerEthereumChain()
            registerEthereumAccountsAdapter()
            registerEthereumAccountPresentation()
        })
        afterEach(restoreAlgorandOnlyChains)

        it.each([
            [
                'a private-key',
                { kind: 'local', seed: null },
                'account_info.type_private_key',
            ],
            [
                'an HD',
                {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                'account_info.type_universal_wallet',
            ],
            [
                'a Ledger',
                {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'device',
                        deviceName: 'Ledger Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                'account_info.type_ledger',
            ],
        ] as const)(
            'labels %s account with the EVM copy, never Algo25',
            (_, custody, expected) => {
                const { result } = renderHook(() =>
                    useAccountTypeLabel(ethAccount(custody)),
                )

                expect(result.current.label).toBe(expected)
            },
        )

        it('labels it unknown, not as an Algorand account, when no adapter reads its chain', () => {
            registerAlgorandAccountsAdapter()

            const { result } = renderHook(() =>
                useAccountTypeLabel(ethAccount({ kind: 'local', seed: null })),
            )

            expect(result.current.label).toBe('account_info.type_unknown')
        })

        it('labels a watch account as a watch account, not No Auth, when nothing signs for it', () => {
            mockUseCanSignWith.mockReturnValue(false)

            const { result } = renderHook(() =>
                useAccountTypeLabel(ethAccount({ kind: 'watch' })),
            )

            expect(result.current.label).toBe('account_info.type_watch')
        })
    })
})
