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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountInfoCard } from '../useAccountInfoCard'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type HardwareWalletAccount,
    type LocalAccount,
    type MultiSigAccount,
    type DelegateTransition,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { accountForType } from '@test-utils/accountCustody'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'

const mockNavigate = vi.fn()
vi.mock('@routes/navigationRef', () => ({
    navigationRef: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params?.number != null)
                return key.replace('{{number}}', String(params.number))
            if (params?.count != null) return `${key} (${params.count})`
            if (params?.network != null) return `${key} (${params.network})`
            return key
        },
    }),
}))

type ChainOption = { chainId: string; isEnabled: boolean; address?: string }

const enabledOptionsOf = (account: WalletAccount): ChainOption[] =>
    Object.entries(account.chains).map(([chainId, entry]) => ({
        chainId,
        isEnabled: true,
        address: entry?.address,
    }))

const mockUseHdSeedGroups = vi.fn()
const mockUseLedgerDeviceGroups = vi.fn()
const mockUseCanSignWith = vi.fn<() => boolean>()
const mockUseDelegatedTransition = vi.fn<() => DelegateTransition | null>()
const mockOptionsFor = vi.fn<(account: WalletAccount) => ChainOption[]>()
let mockSwitchedOff: string[] = []

let mockIsMultichain = true
vi.mock('../../../hooks/useIsMultichain', () => ({
    useIsMultichain: () => mockIsMultichain,
}))

vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainId: () => 'base',
    useCapableChainIds: () => ['base'],
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useHdSeedGroups: () => mockUseHdSeedGroups(),
        useCapabilityChainResolver:
            () =>
            ({ chains }: { chains: Record<string, unknown> }) =>
                Object.keys(chains)[0],
        useLedgerDeviceGroups: () => mockUseLedgerDeviceGroups(),
        useCanSignWith: () => mockUseCanSignWith(),
        useDelegatedTransition: () => mockUseDelegatedTransition(),
        accountChainOptions: (
            account: WalletAccount,
            isOn: (chainId: string) => boolean,
        ) => mockOptionsFor(account).filter(option => isOn(option.chainId)),
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    chainDisplayNameOf: (chainId: string) =>
        ({ algorand: 'Algorand', ethereum: 'Ethereum', base: 'Base' })[chainId],
    useSwitchedOffChainIds: () => mockSwitchedOff,
}))

vi.mock('@perawallet/wallet-core-chain-contract', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-contract')
    >()),
    addressCodecs: {
        has: () => true,
        get: (chainId: string) => ({
            truncate: (address: string) => `${chainId}:${address}`,
            isValid: (address: string) => !address.startsWith('bad'),
            normalize: (address: string) => {
                if (address.startsWith('bad')) throw new Error('bad address')
                return address.toUpperCase()
            },
        }),
    },
}))

const hdAccount: LocalAccount = {
    id: 'hd-account',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: 'HD_ADDR', keyPairId: 'key-1' } },
}

const ledgerAccount: HardwareWalletAccount = {
    id: 'ledger-account',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'device-abc',
            deviceName: 'My Ledger',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: { algorand: { address: 'LEDGER_ADDR' } },
}

const watchAccount: WalletAccount = {
    id: 'watch-account',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'WATCH_ADDR' } },
}

const multisigAccount: MultiSigAccount = {
    id: 'multisig-account',
    custody: { kind: 'multisig' },
    chains: {
        algorand: {
            address: 'MULTISIG_ADDR',
            native: {
                family: 'algorand',
                multisig: {
                    threshold: 2,
                    addresses: ['ADDR_1', 'ADDR_2', 'ADDR_3'],
                    version: 1,
                },
            },
        },
    },
}

const quantumAccount: WalletAccount = {
    id: 'quantum-account',
    custody: { kind: 'local', seed: 'quantum' },
    chains: { algorand: { address: 'QUANTUM_ADDR', keyPairId: 'key-1' } },
}

describe('useAccountInfoCard', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        useAccountChainStateStore.getState().resetState()
        vi.clearAllMocks()
        useAccountsStore.setState({ accounts: [] })
        mockOptionsFor.mockImplementation(enabledOptionsOf)
        mockSwitchedOff = []
        mockIsMultichain = true
        mockUseHdSeedGroups.mockReturnValue({
            hdSeedGroups: [
                {
                    keyPairId: 'key-1',
                    accounts: [hdAccount],
                    firstAccount: hdAccount,
                    accountCount: 1,
                },
            ],
            hasMultipleHdSeeds: false,
        })
        mockUseLedgerDeviceGroups.mockReturnValue({
            ledgerDeviceGroups: [
                {
                    deviceId: 'device-abc',
                    deviceName: 'My Ledger',
                    accounts: [ledgerAccount],
                    firstAccount: ledgerAccount,
                    accountCount: 1,
                },
            ],
            hasMultipleLedgerDevices: false,
        })
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue(null)
    })

    test('HD wallet account: showStructure true with wallet label and wallet icon', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(true)
        expect(result.current.structureIcon).toBe('wallet')
        expect(result.current.structureLabel).toBe('account_info.wallet_label')
        expect(result.current.structureRows.map(row => row.account)).toEqual([
            hdAccount,
        ])
    })

    test('Ledger account: showStructure true with deviceName and ledger icon', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(true)
        expect(result.current.structureIcon).toBe('ledger')
        expect(result.current.structureLabel).toBe('My Ledger')
        expect(result.current.structureRows.map(row => row.account)).toEqual([
            ledgerAccount,
        ])
    })

    test("Ledger account with sub-addresses: the device's first account is the main one", () => {
        const subLedgerAccount: HardwareWalletAccount = {
            id: 'ledger-sub-account',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'device-abc',
                    deviceName: 'My Ledger',
                    transportType: 'ble',
                },
                accountIndex: 1,
            },
            chains: { algorand: { address: 'LEDGER_SUB_ADDR' } },
        }
        mockUseLedgerDeviceGroups.mockReturnValueOnce({
            ledgerDeviceGroups: [
                {
                    deviceId: 'device-abc',
                    deviceName: 'My Ledger',
                    accounts: [ledgerAccount, subLedgerAccount],
                    firstAccount: ledgerAccount,
                    accountCount: 2,
                },
            ],
            hasMultipleLedgerDevices: false,
        })
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: subLedgerAccount,
                onClose: vi.fn(),
            }),
        )
        expect(
            result.current.structureRows.map(row => [row.account, row.name]),
        ).toEqual([
            [ledgerAccount, 'account_info.main_address'],
            [subLedgerAccount, 'account_info.sub_address'],
        ])
    })

    test('Watch account: showStructure false', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: watchAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(false)
        expect(result.current.structureRows).toEqual([])
    })

    describe('structure rows', () => {
        const hdSibling = (
            id: string,
            chains: WalletAccount['chains'],
            name?: string,
        ): LocalAccount => ({
            id,
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 1, keyIndex: 0 },
            },
            chains,
            name,
        })

        const withHdGroup = (accounts: WalletAccount[]) =>
            mockUseHdSeedGroups.mockReturnValue({
                hdSeedGroups: [
                    {
                        keyPairId: 'key-1',
                        accounts,
                        firstAccount: accounts[0],
                        accountCount: accounts.length,
                    },
                ],
                hasMultipleHdSeeds: false,
            })

        const render = (account: WalletAccount = hdAccount) =>
            renderHook(() => useAccountInfoCard({ account, onClose: vi.fn() }))

        const sibling = hdSibling('hd-sibling', {
            algorand: { address: 'SIB_ADDR', keyPairId: 'key-2' },
            ethereum: { address: '0xabc', keyPairId: 'key-3' },
        })

        test('lists each account in the wallet with its enabled chains in order', () => {
            withHdGroup([hdAccount, sibling])
            mockOptionsFor.mockImplementation(account =>
                account.id === hdAccount.id
                    ? [
                          {
                              chainId: 'algorand',
                              isEnabled: true,
                              address: 'HD_ADDR',
                          },
                          {
                              chainId: 'ethereum',
                              isEnabled: true,
                              address: '0xdef',
                          },
                          {
                              chainId: 'base',
                              isEnabled: false,
                              address: '0xdef',
                          },
                      ]
                    : enabledOptionsOf(account),
            )

            const { result } = render()

            expect(
                result.current.structureRows[0].chains.map(c => c.chainId),
            ).toEqual(['algorand', 'ethereum'])
        })

        test("marks only the sheet's account as viewing", () => {
            withHdGroup([hdAccount, sibling])

            const { result } = render()

            expect(
                result.current.structureRows.map(row => row.isViewing),
            ).toEqual([true, false])
        })

        test('drops chains the user switched off', () => {
            withHdGroup([hdAccount, sibling])
            mockSwitchedOff = ['ethereum']

            const { result } = render()

            expect(
                result.current.structureRows[1].chains.map(c => c.chainId),
            ).toEqual(['algorand'])
        })

        test('gives truncated and normalized addresses per chain', () => {
            withHdGroup([hdAccount, sibling])

            const { result } = render()

            expect(result.current.structureRows[1].chains[1]).toEqual({
                chainId: 'ethereum',
                displayName: 'Ethereum',
                address: 'ethereum:0xabc',
                copyValue: '0XABC',
            })
        })

        test('copies an address its codec cannot parse as stored, rather than throwing', () => {
            const malformed = hdSibling('malformed', {
                ethereum: { address: 'bad-address', keyPairId: 'key-8' },
            })
            withHdGroup([hdAccount, malformed])

            const { result } = render()

            expect(result.current.structureRows[1].chains[0].copyValue).toBe(
                'bad-address',
            )
        })

        test('falls back to main and sub labels for unnamed accounts', () => {
            const unnamedMain = { ...hdAccount, name: undefined }
            const namedAfterTruncation = hdSibling(
                'truncated-name',
                { ethereum: { address: '0xabc', keyPairId: 'key-3' } },
                'ethereum:0xabc',
            )
            const namedAfterAddress = hdSibling(
                'full-name',
                { algorand: { address: 'FULL_ADDR', keyPairId: 'key-4' } },
                'FULL_ADDR',
            )
            const named = hdSibling(
                'savings',
                { algorand: { address: 'SAV_ADDR', keyPairId: 'key-5' } },
                'Savings',
            )
            withHdGroup([
                unnamedMain,
                namedAfterTruncation,
                namedAfterAddress,
                named,
            ])

            const { result } = render(unnamedMain)

            expect(result.current.structureRows.map(row => row.name)).toEqual([
                'account_info.main_address',
                'account_info.sub_address',
                'account_info.sub_address',
                'Savings',
            ])
        })

        test('treats a legacy auto-name cut from its own address as unnamed', () => {
            const legacyNamed = hdSibling(
                'legacy-name',
                {
                    algorand: {
                        address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                        keyPairId: 'key-7',
                    },
                },
                'ABCDEF...UVWXYZ',
            )
            withHdGroup([hdAccount, legacyNamed])

            const { result } = render()

            expect(result.current.structureRows[1].name).toBe(
                'account_info.sub_address',
            )
        })

        test('treats a name cut from a switched-off chain address as unnamed', () => {
            const ethereumNamed = hdSibling(
                'switched-off-name',
                {
                    algorand: { address: 'SIB_ADDR', keyPairId: 'key-2' },
                    ethereum: { address: '0xabc', keyPairId: 'key-3' },
                },
                '0xabc',
            )
            withHdGroup([hdAccount, ethereumNamed])
            mockSwitchedOff = ['ethereum']

            const { result } = render()

            expect(result.current.structureRows[1].name).toBe(
                'account_info.sub_address',
            )
        })

        test('opens one row at a time and closes it on a second tap', () => {
            const third = hdSibling('hd-third', {
                algorand: { address: 'THIRD_ADDR', keyPairId: 'key-6' },
            })
            withHdGroup([hdAccount, sibling, third])
            const { result } = render()

            act(() => result.current.handleToggleRow('hd-sibling'))
            expect(result.current.expandedRowId).toBe('hd-sibling')

            act(() => result.current.handleToggleRow('hd-third'))
            expect(result.current.expandedRowId).toBe('hd-third')

            act(() => result.current.handleToggleRow('hd-third'))
            expect(result.current.expandedRowId).toBeUndefined()
        })

        test('never opens the viewing row', () => {
            withHdGroup([hdAccount, sibling])
            const { result } = render()

            act(() => result.current.handleToggleRow(hdAccount.id))

            expect(result.current.structureRows[0].canExpand).toBe(false)
            expect(result.current.expandedRowId).toBeUndefined()
        })

        test('never opens a row with no chain shown', () => {
            withHdGroup([hdAccount, sibling])
            mockSwitchedOff = ['algorand', 'ethereum']
            const { result } = render()

            act(() => result.current.handleToggleRow('hd-sibling'))

            expect(result.current.structureRows[1].canExpand).toBe(false)
            expect(result.current.expandedRowId).toBeUndefined()
        })

        test('gives the subtitle to Universal Wallets only', () => {
            const { result: hd } = render()
            const { result: ledger } = render(ledgerAccount)

            expect(hd.current.structureSubtitle).toBe(
                'account_info.universal_wallet_subtitle',
            )
            expect(ledger.current.structureSubtitle).toBeUndefined()
            expect(
                ledger.current.structureRows[0].chains.map(c => c.chainId),
            ).toEqual(['algorand'])
        })

        test('uses the plain scan label when one chain is active', () => {
            mockIsMultichain = false

            const { result } = render()

            expect(result.current.scanLabel).toBe(
                'account_info.scan_new_addresses',
            )
        })

        test('drops the subtitle when one chain is active', () => {
            mockIsMultichain = false

            const { result } = render()

            expect(result.current.structureSubtitle).toBeUndefined()
        })

        test('reports whether more than one chain is active', () => {
            const { result: multichain } = render()
            mockIsMultichain = false
            const { result: singleChain } = render()

            expect(multichain.current.isMultichain).toBe(true)
            expect(singleChain.current.isMultichain).toBe(false)
        })

        test('names the chain a Universal Wallet scan walks', () => {
            const { result } = render()

            expect(result.current.scanLabel).toBe(
                'account_info.scan_new_accounts (Algorand)',
            )
        })

        test("names the Ledger account's own chain in its scan label", () => {
            const ethereumLedger: HardwareWalletAccount = {
                ...ledgerAccount,
                chains: { ethereum: { address: '0xledger' } },
            }
            mockUseLedgerDeviceGroups.mockReturnValue({
                ledgerDeviceGroups: [
                    {
                        deviceId: 'device-abc',
                        deviceName: 'My Ledger',
                        accounts: [ethereumLedger],
                        firstAccount: ethereumLedger,
                        accountCount: 1,
                    },
                ],
                hasMultipleLedgerDevices: false,
            })

            const { result } = render(ethereumLedger)

            expect(result.current.scanLabel).toBe(
                'account_info.scan_new_accounts (Ethereum)',
            )
        })

        test('names the first Ledger chain when the device account is on no Ledger chain', () => {
            const chainless: HardwareWalletAccount = {
                ...ledgerAccount,
                chains: {},
            }
            mockUseLedgerDeviceGroups.mockReturnValue({
                ledgerDeviceGroups: [
                    {
                        deviceId: 'device-abc',
                        deviceName: 'My Ledger',
                        accounts: [chainless],
                        firstAccount: chainless,
                        accountCount: 1,
                    },
                ],
                hasMultipleLedgerDevices: false,
            })

            const { result } = render(chainless)

            expect(result.current.scanLabel).toBe(
                'account_info.scan_new_accounts (Base)',
            )
        })
    })

    test('Multisig account: resolves the shared account type label', () => {
        useAccountsStore.setState({
            accounts: [multisigAccount, accountForType('standalone', 'ADDR_1')],
        })
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: multisigAccount,
                onClose: vi.fn(),
            }),
        )

        expect(result.current.accountType.label).toBe(
            'account_info.type_multisig',
        )
    })

    test('Quantum account: resolves the quantum account type label', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: quantumAccount,
                onClose: vi.fn(),
            }),
        )

        expect(result.current.accountType.label).toBe(
            'account_info.type_quantum',
        )
    })

    test('RekeyedSignable account with a transition shows the "Rekeyed (Signed by …)" label', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue({
            from: accountForType('standalone'),
            to: accountForType('hardware'),
        })
        const rekeyed = ledgerAccount
        seedAuthority('LEDGER_ADDR', 'AUTH')
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: rekeyed, onClose: vi.fn() }),
        )
        expect(result.current.accountType.label).toBe(
            'account_info.type_rekeyed_signer',
        )
    })

    test('RekeyedSignable account without a known auth account falls back to generic label', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseDelegatedTransition.mockReturnValue(null)
        const rekeyed = ledgerAccount
        seedAuthority('LEDGER_ADDR', 'AUTH')
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: rekeyed, onClose: vi.fn() }),
        )
        expect(result.current.accountType.label).toBe(
            'account_info.type_rekeyed',
        )
    })

    test('HD wallet handleScanAddresses navigates to SearchAccounts', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose }),
        )
        act(() => {
            result.current.handleScanAddresses()
        })
        expect(onClose).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'SearchAccounts',
            params: { account: hdAccount, notifyOnEmpty: true },
        })
    })

    test('Ledger handleScanAddresses navigates to LedgerFetchAccounts with deviceId/deviceName', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose }),
        )
        act(() => {
            result.current.handleScanAddresses()
        })
        expect(onClose).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'LedgerFetchAccounts',
            params: {
                chainId: 'algorand',
                deviceId: 'device-abc',
                deviceName: 'My Ledger',
                transportType: 'ble',
            },
        })
    })

    test('Watch handleScanAddresses is a no-op', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: watchAccount, onClose }),
        )
        act(() => {
            result.current.handleScanAddresses()
        })
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    test('handleToggleExpanded toggles isExpanded', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose: vi.fn() }),
        )
        expect(result.current.isExpanded).toBe(false)
        act(() => {
            result.current.handleToggleExpanded()
        })
        expect(result.current.isExpanded).toBe(true)
    })
})
