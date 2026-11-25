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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    useAccountCapabilityScope,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockLaunch = vi.fn()
vi.mock('@modules/backup', () => ({
    useBackupFlowLauncher: () => mockLaunch,
}))

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

const mockIsCloudBackupAvailable = vi.fn()
vi.mock('@hooks/useIsCloudBackupAvailable', () => ({
    useIsCloudBackupAvailableFor: (account: unknown) =>
        mockIsCloudBackupAvailable(account),
}))

const mockInitialRoute = vi.fn()
vi.mock('@modules/cloud-backup', () => ({
    useCloudBackupInitialRoute: () => mockInitialRoute(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

// The visibility rule itself is owned and tested by
// useShouldPromptMnemonicBackup in wallet-core-backup.
const mockShouldPrompt = vi.fn()
vi.mock('@perawallet/wallet-core-backup', () => ({
    useShouldPromptMnemonicBackup: (...args: unknown[]) =>
        mockShouldPrompt(...args),
}))

import { useBackupReminderBanner } from '../useBackupReminderBanner'

const accountHD: WalletAccount = {
    id: 'hd-account',
    name: '',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { algorand: { address: 'HD1', keyPairId: 'kp' } },
}

describe('useBackupReminderBanner', () => {
    beforeEach(() => {
        mockLaunch.mockReset()
        mockShouldPrompt.mockReset()
        mockNavigate.mockReset()
        mockIsCloudBackupAvailable.mockReset().mockReturnValue(false)
        mockInitialRoute.mockReset().mockReturnValue('CloudBackupHome')
    })

    test('isVisible mirrors the shared backup-prompt rule', () => {
        mockShouldPrompt.mockReturnValue(true)

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(true)
        expect(mockShouldPrompt).toHaveBeenCalledWith(
            accountHD,
            expect.objectContaining({ chainId: 'algorand' }),
        )

        mockShouldPrompt.mockReturnValue(false)
        const { result: hidden } = renderHook(() =>
            useBackupReminderBanner(accountHD),
        )
        expect(hidden.current.isVisible).toBe(false)
    })

    test('onBackUpPassphrase calls launcher with the account', () => {
        mockShouldPrompt.mockReturnValue(true)

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        act(() => result.current.onBackUpPassphrase())
        expect(mockLaunch).toHaveBeenCalledWith(accountHD)
    })

    test('offers only the passphrase, with the original copy, when Cloud Backup is unavailable', () => {
        mockShouldPrompt.mockReturnValue(true)

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))

        expect(result.current.cloudBackupCtaLabel).toBeUndefined()
        expect(result.current.message).toBe('backup.banner.text')
        expect(result.current.passphraseCtaLabel).toBe('backup.banner.cta')
    })

    test('asks whether Cloud Backup can cover this account', () => {
        mockShouldPrompt.mockReturnValue(true)

        renderHook(() => useBackupReminderBanner(accountHD))

        expect(mockIsCloudBackupAvailable).toHaveBeenCalledWith(accountHD)
    })

    test('offers turning Cloud Backup on before it is configured', () => {
        mockShouldPrompt.mockReturnValue(true)
        mockIsCloudBackupAvailable.mockReturnValue(true)
        mockInitialRoute.mockReturnValue('CloudBackupIntro')

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))

        expect(result.current.message).toBe(
            'backup.banner.text_with_cloud_backup',
        )
        expect(result.current.passphraseCtaLabel).toBe(
            'backup.banner.cta_passphrase',
        )
        expect(result.current.cloudBackupCtaLabel).toBe(
            'backup.banner.cta_turn_on_cloud_backup',
        )
    })

    test('offers fixing a configured Cloud Backup that does not cover the account', () => {
        mockShouldPrompt.mockReturnValue(true)
        mockIsCloudBackupAvailable.mockReturnValue(true)
        mockInitialRoute.mockReturnValue('CloudBackupOverview')

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))

        expect(result.current.cloudBackupCtaLabel).toBe(
            'backup.banner.cta_fix_cloud_backup',
        )
    })

    test('onOpenCloudBackup opens Cloud Backup on its initial screen', () => {
        mockShouldPrompt.mockReturnValue(true)
        mockIsCloudBackupAvailable.mockReturnValue(true)

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        act(() => result.current.onOpenCloudBackup())

        expect(mockNavigate).toHaveBeenCalledWith('Settings', {
            screen: 'CloudBackupSettings',
            params: { screen: 'CloudBackupHome' },
        })
    })

    test("asks about an Ethereum-only account's own chain", () => {
        mockShouldPrompt.mockReturnValue(false)
        const evmOnly: WalletAccount = {
            id: 'evm-account',
            name: '',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            chains: { ethereum: { address: '0xE1', keyPairId: 'kp-evm' } },
        }

        renderHook(() => useBackupReminderBanner(evmOnly))

        expect(mockShouldPrompt).toHaveBeenCalledWith(
            evmOnly,
            expect.objectContaining({ chainId: 'ethereum' }),
        )
    })

    test("asks about the phrase chain's scope for an account found active only on Ethereum", () => {
        mockShouldPrompt.mockReturnValue(false)
        vi.mocked(useAccountCapabilityScope).mockReturnValueOnce({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        const evmFirst: WalletAccount = {
            id: 'evm-first',
            name: '',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            chains: {
                algorand: {
                    address: 'HD1',
                    keyPairId: 'kp-a',
                    enabledBy: 'created',
                },
                ethereum: {
                    address: '0xE1',
                    keyPairId: 'kp-e',
                    enabledBy: 'discovery',
                },
            },
        }

        renderHook(() => useBackupReminderBanner(evmFirst))

        expect(mockShouldPrompt).toHaveBeenCalledWith(
            evmFirst,
            expect.objectContaining({ chainId: 'algorand' }),
        )
    })
})
