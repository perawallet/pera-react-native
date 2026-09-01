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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import { useAccountDisplay } from '../useAccountDisplay'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

let mockNfdNames: { name: string }[] | undefined
let mockAccountTypeLabel: string | undefined
let mockShouldPromptBackup: boolean

// The global setup stubs getAccountDisplayName as `name || ''`, which erases
// the unnamed-account (truncated-address) behavior this hook branches on.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal =>
    importOriginal<typeof import('@perawallet/wallet-core-accounts')>(),
)

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: () => ({ data: mockNfdNames }),
}))

vi.mock('@modules/accounts/hooks/useAccountTypeLabel', () => ({
    useAccountTypeLabel: () => ({ label: mockAccountTypeLabel }),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useShouldPromptMnemonicBackup: () => mockShouldPromptBackup,
}))

const ADDRESS = 'A'.repeat(58)

const makeAccount = (name?: string): WalletAccount =>
    ({ address: ADDRESS, name }) as unknown as WalletAccount

describe('useAccountDisplay', () => {
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
})
