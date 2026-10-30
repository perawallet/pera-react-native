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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import { useAccountDisplay } from '../useAccountDisplay'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'

let mockNfdNames: { name: string }[] | undefined
let mockAccountTypeLabel: string | undefined
let mockShouldPromptBackup: boolean

// The global setup stubs getAccountDisplayName as `name || ''`, which erases
// the unnamed-account (truncated-address) behavior this hook branches on.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-accounts')>(),
)

vi.mock('@hooks/useLanguage')

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: () => ({ data: mockNfdNames }),
}))

vi.mock('@hooks/useAccountTypeLabel', () => ({
    useAccountTypeLabel: () => ({ label: mockAccountTypeLabel }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useShouldPromptMnemonicBackup: () => mockShouldPromptBackup,
}))

const ADDRESS = 'A'.repeat(58)

const ETH_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const makeAccount = (name?: string): WalletAccount => ({
    id: 'account-1',
    name,
    custody: { kind: 'watch' },
    chains: { algorand: { address: ADDRESS } },
})

describe('useAccountDisplay', () => {
    beforeAll(() => {
        registerAlgorandAddressCodec()
        registerEthereumChain()
    })

    beforeEach(() => {
        mockNfdNames = undefined
        mockAccountTypeLabel = undefined
        mockShouldPromptBackup = false
    })

    it('shows the truncated address as secondary for a named account', () => {
        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount('My Wallet'),
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).toBe('My Wallet')
        expect(result.current.secondaryText).toBe(
            truncateAlgorandAddress(ADDRESS),
        )
        expect(result.current.renderSecondary).toBe(true)
    })

    it("shows a named account's address on the given chain, truncated by that chain's codec", () => {
        const account: WalletAccount = {
            ...makeAccount('My Wallet'),
            chains: {
                algorand: { address: ADDRESS },
                ethereum: { address: ETH_ADDRESS },
            },
        }

        const { result } = renderHook(() =>
            useAccountDisplay({
                account,
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
                chainId: 'ethereum',
            }),
        )

        expect(result.current.secondaryText).toBe(
            addressCodecs.get('ethereum').truncate(ETH_ADDRESS),
        )
    })

    it("reports the chain it resolved: the given one, else the account's own", () => {
        const account: WalletAccount = {
            id: 'account-2',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: ETH_ADDRESS } },
        }
        const base = {
            compact: false,
            showAccountType: false,
            iconSize: 'xl',
        } as const

        const given = renderHook(() =>
            useAccountDisplay({ ...base, account, chainId: 'ethereum' }),
        )
        const inferred = renderHook(() =>
            useAccountDisplay({ ...base, account }),
        )

        expect(given.result.current.chainId).toBe('ethereum')
        expect(inferred.result.current.chainId).toBe('ethereum')
    })

    it('names an unnamed Ethereum-only account by its truncated address', () => {
        const account: WalletAccount = {
            id: 'account-2',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: ETH_ADDRESS } },
        }
        const truncated = addressCodecs.get('ethereum').truncate(ETH_ADDRESS)

        const { result } = renderHook(() =>
            useAccountDisplay({
                account,
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
                chainId: 'ethereum',
            }),
        )

        expect(result.current.displayName).toBe(truncated)
        expect(result.current.renderSecondary).toBe(false)
    })

    it('names an unnamed Universal Wallet account by its number and shows its address, not its type, below', () => {
        mockAccountTypeLabel = 'account_info.type_universal_wallet'
        const account: WalletAccount = {
            id: 'account-3',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            chains: { algorand: { address: ADDRESS, keyPairId: 'key' } },
        }

        const { result } = renderHook(() =>
            useAccountDisplay({
                account,
                compact: false,
                showAccountType: true,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).toBe('account_info.account_number')
        expect(result.current.showTypeAsSecondary).toBe(false)
        expect(result.current.secondaryText).toBe(
            truncateAlgorandAddress(ADDRESS),
        )
    })

    it('suppresses the secondary line when it repeats the primary', () => {
        mockNfdNames = [{ name: 'pera.algo' }]

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount('pera.algo'),
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).toBe('pera.algo')
        expect(result.current.renderSecondary).toBe(false)
    })

    it('keeps the raw secondary in compact mode where it is the only label', () => {
        mockNfdNames = [{ name: 'pera.algo' }]

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount('pera.algo'),
                compact: true,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.secondaryText).toBe('pera.algo')
        expect(result.current.renderSecondary).toBe(true)
    })

    it('collapses to a single truncated address when the name is a legacy truncation of the address', () => {
        // Legacy native apps auto-named accounts with a 6+6 truncated address;
        // migration keeps that name, which must not render as address-twice.
        const legacyName = `${ADDRESS.slice(0, 6)}...${ADDRESS.slice(-6)}`

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount(legacyName),
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).toBe(
            truncateAlgorandAddress(ADDRESS),
        )
        expect(result.current.renderSecondary).toBe(false)
    })

    it('shows the NFD as secondary when a legacy-truncation name is present', () => {
        mockNfdNames = [{ name: 'flavortown.algo' }]
        const legacyName = `${ADDRESS.slice(0, 6)}...${ADDRESS.slice(-6)}`

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount(legacyName),
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).toBe(
            truncateAlgorandAddress(ADDRESS),
        )
        expect(result.current.secondaryText).toBe('flavortown.algo')
        expect(result.current.renderSecondary).toBe(true)
    })

    it('shows the account type for unnamed accounts when requested', () => {
        mockAccountTypeLabel = 'Ledger account'

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount(),
                compact: false,
                showAccountType: true,
                iconSize: 'xl',
            }),
        )

        expect(result.current.secondaryText).toBe('Ledger account')
        expect(result.current.showTypeAsSecondary).toBe(true)
    })

    it("shows a named account's type in place of its address or NFD when always requested", () => {
        mockAccountTypeLabel = 'Ledger account'
        mockNfdNames = [{ name: 'flavortown.algo' }]

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount('My Wallet'),
                compact: false,
                showAccountType: true,
                alwaysShowAccountType: true,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).toBe('My Wallet')
        expect(result.current.secondaryText).toBe('Ledger account')
        expect(result.current.showTypeAsSecondary).toBe(true)
    })

    it('shows the backup badge at the 40px icon formats when backup is required', () => {
        mockShouldPromptBackup = true

        for (const iconSize of ['md', 'lg', 'xl'] as const) {
            const { result } = renderHook(() =>
                useAccountDisplay({
                    account: makeAccount('My Wallet'),
                    compact: false,
                    showAccountType: false,
                    iconSize,
                }),
            )

            expect(result.current.showBackupBadge).toBe(true)
        }
    })

    it('hides the backup badge on the small icon format', () => {
        mockShouldPromptBackup = true

        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount('My Wallet'),
                compact: false,
                showAccountType: false,
                iconSize: 'sm',
            }),
        )

        expect(result.current.showBackupBadge).toBe(false)
    })

    it('hides the backup badge when the account does not require backup', () => {
        const { result } = renderHook(() =>
            useAccountDisplay({
                account: makeAccount('My Wallet'),
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.showBackupBadge).toBe(false)
    })

    it("truncates an Ethereum account's address with its own chain's codec", () => {
        registerEthereumChain()
        const ethAddress = `0x${'c'.repeat(40)}`
        const account: WalletAccount = {
            id: 'account-eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: ethAddress } },
        }

        const { result } = renderHook(() =>
            useAccountDisplay({
                account,
                compact: false,
                showAccountType: false,
                iconSize: 'xl',
            }),
        )

        expect(result.current.displayName).not.toBe('No Address Found')
        expect(result.current.displayName).not.toBe(ethAddress)
        expect(result.current.displayName.startsWith('0x')).toBe(true)
    })
})
