/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { render, screen, fireEvent, waitFor } from '@test-utils/render'
import { within } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useBackupStore } from '@perawallet/wallet-core-backup'

const account: WalletAccount = {
    type: AccountTypes.algo25,
    address: 'ADDR_A',
    keyPairId: 'kp-A',
    seedKeyId: 'seed-A',
}

const CORRECT_PAIRS = [
    { index: 0, word: 'alpha' },
    { index: 2, word: 'charlie' },
    { index: 5, word: 'foxtrot' },
]

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountsStore: (
            selector: (state: { accounts: WalletAccount[] }) => unknown,
        ) => selector({ accounts: [account] }),
    }
})

const mockReplace = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({
            replace: mockReplace,
            navigate: mockNavigate,
        }),
        useRoute: () => ({ params: { address: account.address } }),
    }
})

vi.mock('@perawallet/wallet-core-kms', () => ({
    MNEMONIC_WORDLIST: [
        'bravo',
        'delta',
        'echo',
        'golf',
        'hotel',
        'india',
        'juliet',
        'kilo',
        'lima',
        'mike',
    ],
    uniformIntBelow: (max: number) =>
        max <= 0 ? 0 : Math.floor(Math.random() * max),
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) {
            if (buf) buf.fill(0)
        }
    },
}))

vi.mock('../hooks', async importOriginal => {
    const original = await importOriginal<typeof import('../hooks')>()
    return {
        ...original,
        useRandomMnemonicForAddress: () => ({
            picks: [
                { index: 0, word: 'alpha' },
                { index: 2, word: 'charlie' },
                { index: 5, word: 'foxtrot' },
            ],
            isLoading: false,
            error: null,
        }),
    }
})

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Error: 'error' },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (
                key === 'backup.verification.select_word' &&
                params?.number !== undefined
            ) {
                return `Select word #${params.number}`
            }
            return key
        },
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import { BackupVerificationScreen } from '../screens/BackupVerificationScreen'

describe('Backup flow - Algo25 end-to-end outcome', () => {
    beforeEach(() => {
        useBackupStore.getState().resetState()
        mockReplace.mockReset()
        mockNavigate.mockReset()
    })

    test('completing verification marks seedKeyId as backed up and navigates to success', async () => {
        render(<BackupVerificationScreen />)

        const labels = screen.getAllByText(/^Select word #\d+$/)
        labels.forEach((node, i) => {
            const text = (node as HTMLElement).textContent ?? ''
            const match = /#(\d+)/.exec(text)
            const position = match ? Number(match[1]) - 1 : 0
            const correctPair = CORRECT_PAIRS.find(p => p.index === position)
            const itemEl = screen.getByTestId(
                `backup_verification_item_${i}`,
            ) as HTMLElement
            const correctBtn = within(itemEl).getByTestId(
                `backup_verification_item_${i}_option_${correctPair?.word}`,
            )
            fireEvent.click(correctBtn)
        })

        fireEvent.click(screen.getByTestId('backup_verification_next'))

        await waitFor(() => {
            expect(useBackupStore.getState().isBackedUp('seed-A')).toBe(true)
        })

        const allCalls = [...mockReplace.mock.calls, ...mockNavigate.mock.calls]
        const sawSuccess = allCalls.some(c => c[0] === 'BackupSuccess')
        expect(sawSuccess).toBe(true)
    })
})
