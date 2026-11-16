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

// Side-effect import: initialize react-i18next with the production English
// resources. The verification quiz queries each item's "Select word #N"
// label to recover the picked position — without translations the label
// renders as the raw i18n key and that lookup falls apart. Init is
// idempotent, so other integration files are unaffected if they don't
// import this module.
import '../i18n'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    deriveHdAccount,
    seedOf,
    signingKeyOn,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    mnemonicWordsToIndices,
    useKMS,
    type Algo25KeyResult,
    type HDWalletKeyResult,
} from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import {
    useMarkMnemonicBackupComplete,
    useMnemonicBackupStore,
    useRequiresMnemonicBackup,
} from '@perawallet/wallet-core-backup'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'

import { BackupInfoScreen } from '@modules/backup/screens/BackupInfoScreen'
import { BackupReminderWriteDownScreen } from '@modules/backup/screens/BackupReminderWriteDownScreen'
import { BackupReminderMnemonicScreen } from '@modules/backup/screens/BackupReminderMnemonicScreen'
import { BackupVerificationScreen } from '@modules/backup/screens/BackupVerificationScreen'
import { BackupReminderSuccessScreen } from '@modules/backup/screens/BackupReminderSuccessScreen'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    ALGO25_TEST_MNEMONIC_WORDS,
    HD_TEST_MNEMONIC_12_DISTINCT,
    HD_TEST_MNEMONIC_12_DISTINCT_WORDS,
    HD_TEST_MNEMONIC_24,
    HD_TEST_MNEMONIC_24_WORDS,
} from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

// Mint an algo25 key from the pinned `ALGO25_TEST_MNEMONIC` and register
// the resulting WalletAccount in the store. The account holds the signing
// child, as in production; backup state is read back under its seed.
const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await act(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(key).not.toBeNull()
    })
    const account: WalletAccount = {
        id: 'algo25-1',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: ALGO25_TEST_ADDRESS,
                keyPairId: key!.signKeyId,
            },
        },
        name: 'Algo25 Test',
    }
    useAccountsStore.getState().setAccounts([account])
    useAccountsStore.getState().setSelectedAccountId(account.id)
    return account
}

const deriveHdWalletAccount = async (
    seedKeyId: string,
    id: string,
    keyIndex: number,
): Promise<WalletAccount> => {
    const derived = await deriveHdAccount(
        getSelectedScope(ALGORAND_CHAIN_ID),
        seedKeyId,
        { account: 0, keyIndex },
    )
    return {
        id,
        custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex } },
        chains: {
            algorand: {
                address: derived.address,
                keyPairId: derived.keyPairId,
            },
        },
        name: id,
    }
}

type SeededHDAccounts = {
    rootAccount: WalletAccount
    sibling1: WalletAccount
    sibling2: WalletAccount
    rootKeyId: string
}

// Mint an HD root key and register the master account plus two siblings
// derived at keyIndex=1 and keyIndex=2. Each account holds its own derived
// child key, as in production, so the siblings share backup state only
// through the seed they derive from.
const seedHDWalletAccounts = async (params?: {
    mnemonic: string
}): Promise<SeededHDAccounts> => {
    const mnemonic = params?.mnemonic ?? HD_TEST_MNEMONIC_24
    const { result: kms } = renderHook(() => useKMS())
    let rootKey: HDWalletKeyResult | null = null
    await act(async () => {
        rootKey = await kms.current.createHDWalletKey({
            mnemonicIndices: mnemonicWordsToIndices(mnemonic.split(' '))!,
        })
        expect(rootKey).not.toBeNull()
    })
    const rootKeyId = rootKey!.seedKey.id ?? ''
    const rootAccount = await deriveHdWalletAccount(rootKeyId, 'hd-root', 0)
    const sibling1 = await deriveHdWalletAccount(rootKeyId, 'hd-s1', 1)
    const sibling2 = await deriveHdWalletAccount(rootKeyId, 'hd-s2', 2)
    useAccountsStore.getState().setAccounts([rootAccount, sibling1, sibling2])
    useAccountsStore.getState().setSelectedAccountId(rootAccount.id)
    return { rootAccount, sibling1, sibling2, rootKeyId }
}

type BackupRouteName =
    | 'BackupInfo'
    | 'BackupWriteDown'
    | 'BackupMnemonic'
    | 'BackupVerification'
    | 'BackupSuccess'

// Mount every screen the production navigator declares (see
// modules/backup/routes/index.tsx) so `navigation.navigate(...)` traversals
// across screens resolve to real targets in the in-memory test navigator.
const renderBackupStack = (
    address: string,
    initialRouteName: BackupRouteName = 'BackupInfo',
) => {
    renderWithNavigation(BackupInfoScreen, 'BackupInfo', {
        initialRouteName,
        initialParams: { address },
        additionalScreens: [
            {
                name: 'BackupWriteDown',
                component: BackupReminderWriteDownScreen,
                params: { address },
            },
            {
                name: 'BackupMnemonic',
                component: BackupReminderMnemonicScreen,
                params: { address },
            },
            {
                name: 'BackupVerification',
                component: BackupVerificationScreen,
                params: { address },
            },
            {
                name: 'BackupSuccess',
                component: BackupReminderSuccessScreen,
            },
        ],
    })
}

// Option testIDs carry the index, not the word, so the seed never lands in an
// automation ID; resolve options by their visible text instead.
const quizOptions = (item: HTMLElement): HTMLElement[] =>
    within(item).getAllByTestId(/^backup_verification_item_\d+_option_\d+$/)

const optionWords = (item: HTMLElement): string[] =>
    quizOptions(item).map(option => option.textContent ?? '')

const optionFor = (item: HTMLElement, word: string): HTMLElement => {
    const option = quizOptions(item).find(o => o.textContent === word)
    if (!option) {
        throw new Error(`No option rendered for word: ${word}`)
    }
    return option
}

// Read the position label (`Select word #N`) inside one quiz item. The
// label is the only piece of state on screen that tells us *which* word
// the user is being asked for — the item testID is just the array index.
const positionOf = (item: HTMLElement): number => {
    const label = within(item).getByText(/^Select word #\d+$/)
    const match = /Select word #(\d+)/.exec(label.textContent ?? '')
    if (!match) {
        throw new Error(
            `Item is missing a position label: ${label.textContent}`,
        )
    }
    return Number(match[1]) - 1
}

// Pick the correct option for every quiz item, then submit. Waits first
// for the items to mount (the screen has to round-trip through the KMS
// before `useRandomMnemonicForAddress` resolves and the items render).
const completeVerificationQuiz = async (
    mnemonicWords: readonly string[],
): Promise<void> => {
    await waitFor(
        () => {
            expect(
                screen.getByTestId('backup_verification_item_0'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('backup_verification_item_1'),
            ).toBeTruthy()
            expect(
                screen.getByTestId('backup_verification_item_2'),
            ).toBeTruthy()
        },
        { timeout: 10_000 },
    )

    for (let i = 0; i < 3; i++) {
        const item = screen.getByTestId(`backup_verification_item_${i}`)
        const correctWord = mnemonicWords[positionOf(item)]
        fireEvent.click(optionFor(item, correctWord))
    }

    fireEvent.click(screen.getByTestId('backup_verification_next'))
}

describe('Flow: Account backup', () => {
    beforeEach(() => {
        // resetTestKeystore wipes both account keys AND the typed-secret
        // entries (PIN, biometric blob), so the PIN gate test starts from
        // a clean state without leaking state from a previous case.
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useMnemonicBackupStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('Given an algo25 account, when the user walks the full backup flow and answers verification correctly, then the wallet root is marked backed up and the success screen renders', async () => {
        const account = await seedAlgo25Account()
        expect(
            useMnemonicBackupStore.getState().isBackedUp(seedOf(account)!),
        ).toBe(false)

        renderBackupStack(addressOf(account))

        // Info → write-down → mnemonic.
        fireEvent.click(await screen.findByTestId('backup_info_continue'))
        fireEvent.click(await screen.findByTestId('backup_write_down_begin'))

        // Mnemonic screen: the KMS decodes the original 25 words from
        // the seeded key, the words grid mounts, and every word from
        // ALGO25_TEST_MNEMONIC is on screen. No PIN was configured, so
        // the gate is bypassed and the continue CTA renders directly.
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('backup_mnemonic_continue'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        for (const word of ALGO25_TEST_MNEMONIC_WORDS) {
            expect(screen.getAllByText(word).length).toBeGreaterThan(0)
        }
        fireEvent.click(screen.getByTestId('backup_mnemonic_continue'))

        // Verification quiz: real picks from real entropy. We read the
        // displayed position label from each item, look the correct
        // word up in the source mnemonic, and click that option.
        await completeVerificationQuiz(ALGO25_TEST_MNEMONIC_WORDS)

        // The success screen mounts and the backup store reflects the
        // completed backup keyed on the wallet root.
        await waitFor(() => {
            expect(screen.getByTestId('backup_success_done')).toBeTruthy()
        })
        expect(
            useMnemonicBackupStore.getState().isBackedUp(seedOf(account)!),
        ).toBe(true)
    })

    it('Given an HD wallet root account, when the user walks the full backup flow, then the 24-word HD mnemonic renders and verification succeeds', async () => {
        const { rootAccount, rootKeyId } = await seedHDWalletAccounts()

        renderBackupStack(addressOf(rootAccount))

        fireEvent.click(await screen.findByTestId('backup_info_continue'))
        fireEvent.click(await screen.findByTestId('backup_write_down_begin'))

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('backup_mnemonic_continue'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        for (const word of HD_TEST_MNEMONIC_24_WORDS) {
            expect(screen.getAllByText(word).length).toBeGreaterThan(0)
        }
        fireEvent.click(screen.getByTestId('backup_mnemonic_continue'))

        await completeVerificationQuiz(HD_TEST_MNEMONIC_24_WORDS)

        await waitFor(() => {
            expect(screen.getByTestId('backup_success_done')).toBeTruthy()
        })
        expect(useMnemonicBackupStore.getState().isBackedUp(rootKeyId)).toBe(
            true,
        )
    })

    it('Given a 12-word HD wallet root account, when the user walks the full backup flow, then the 12-word mnemonic renders and verification succeeds', async () => {
        const { rootAccount, rootKeyId } = await seedHDWalletAccounts({
            mnemonic: HD_TEST_MNEMONIC_12_DISTINCT,
        })

        renderBackupStack(addressOf(rootAccount))

        fireEvent.click(await screen.findByTestId('backup_info_continue'))
        fireEvent.click(await screen.findByTestId('backup_write_down_begin'))

        await waitFor(
            () =>
                expect(
                    screen.getByTestId('backup_mnemonic_continue'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        for (const word of HD_TEST_MNEMONIC_12_DISTINCT_WORDS) {
            expect(screen.getAllByText(word)).toHaveLength(1)
        }
        fireEvent.click(screen.getByTestId('backup_mnemonic_continue'))

        await completeVerificationQuiz(HD_TEST_MNEMONIC_12_DISTINCT_WORDS)

        await waitFor(() => {
            expect(screen.getByTestId('backup_success_done')).toBeTruthy()
        })
        expect(useMnemonicBackupStore.getState().isBackedUp(rootKeyId)).toBe(
            true,
        )
    })

    it('Given an HD wallet root with two derived siblings sharing the same wallet root, when the user backs up the root, then `useRequiresMnemonicBackup` reads false for every sibling — derived accounts do not get their own backup prompt', async () => {
        const { rootAccount, sibling1, sibling2, rootKeyId } =
            await seedHDWalletAccounts()

        // Baseline: all three accounts surface the requires-backup
        // signal because they share the root and nobody has been
        // marked backed up yet.
        const requires = renderHook(
            ({ account }: { account: WalletAccount }) =>
                useRequiresMnemonicBackup(account, ALGORAND_CHAIN_ID),
            { initialProps: { account: rootAccount } },
        )
        expect(requires.result.current).toBe(true)
        requires.rerender({ account: sibling1 })
        expect(requires.result.current).toBe(true)
        requires.rerender({ account: sibling2 })
        expect(requires.result.current).toBe(true)

        renderBackupStack(addressOf(rootAccount))

        fireEvent.click(await screen.findByTestId('backup_info_continue'))
        fireEvent.click(await screen.findByTestId('backup_write_down_begin'))
        await waitFor(
            () =>
                expect(
                    screen.getByTestId('backup_mnemonic_continue'),
                ).toBeTruthy(),
            { timeout: 10_000 },
        )
        fireEvent.click(screen.getByTestId('backup_mnemonic_continue'))

        await completeVerificationQuiz(HD_TEST_MNEMONIC_24_WORDS)
        await waitFor(() => {
            expect(screen.getByTestId('backup_success_done')).toBeTruthy()
        })

        // After the root is backed up, every account derived from the
        // same root reads as no-longer-requiring-backup. This is the
        // sibling-dedup invariant the old unit test pinned with a
        // probe component.
        expect(useMnemonicBackupStore.getState().isBackedUp(rootKeyId)).toBe(
            true,
        )
        requires.rerender({ account: rootAccount })
        expect(requires.result.current).toBe(false)
        requires.rerender({ account: sibling1 })
        expect(requires.result.current).toBe(false)
        requires.rerender({ account: sibling2 })
        expect(requires.result.current).toBe(false)
    })

    it('Given an HD wallet whose root was backed up, when another account is added to it, then `useRequiresMnemonicBackup` reads false for the new account', async () => {
        const { rootAccount } = await seedHDWalletAccounts()
        const { result: mark } = renderHook(() =>
            useMarkMnemonicBackupComplete(),
        )
        act(() => mark.current(rootAccount))

        const added = await deriveHdWalletAccount(
            seedOf(rootAccount)!,
            'hd-s3',
            3,
        )
        useAccountsStore
            .getState()
            .setAccounts([...useAccountsStore.getState().accounts, added])

        const { result } = renderHook(() =>
            useRequiresMnemonicBackup(added, ALGORAND_CHAIN_ID),
        )
        expect(result.current).toBe(false)
    })

    it('Given a backup saved under the key of one derived account, when its siblings are read, then none requires a backup', async () => {
        const { rootAccount, sibling1, sibling2 } = await seedHDWalletAccounts()
        useMnemonicBackupStore
            .getState()
            .markBackedUp(signingKeyOn(rootAccount, ALGORAND_CHAIN_ID)!)

        const requires = renderHook(
            ({ account }: { account: WalletAccount }) =>
                useRequiresMnemonicBackup(account, ALGORAND_CHAIN_ID),
            { initialProps: { account: rootAccount } },
        )
        expect(requires.result.current).toBe(false)
        requires.rerender({ account: sibling1 })
        expect(requires.result.current).toBe(false)
        requires.rerender({ account: sibling2 })
        expect(requires.result.current).toBe(false)
    })

    it('Given two HD wallets, when one is backed up, then the other still requires a backup', async () => {
        const first = await seedHDWalletAccounts()
        const second = await seedHDWalletAccounts({
            mnemonic: HD_TEST_MNEMONIC_12_DISTINCT,
        })
        const { result: mark } = renderHook(() =>
            useMarkMnemonicBackupComplete(),
        )
        act(() => mark.current(first.rootAccount))

        const requires = renderHook(
            ({ account }: { account: WalletAccount }) =>
                useRequiresMnemonicBackup(account, ALGORAND_CHAIN_ID),
            { initialProps: { account: first.sibling1 } },
        )
        expect(requires.result.current).toBe(false)
        requires.rerender({ account: second.rootAccount })
        expect(requires.result.current).toBe(true)
    })

    it('Given the user submits a wrong answer in verification, when they tap continue, then the backup store stays clear and the success screen does not mount', async () => {
        const account = await seedAlgo25Account()

        // Skip straight to verification — the wrong-answer path is the
        // subject, the Info/WriteDown/Mnemonic legs are exercised by
        // the happy-path tests above.
        renderBackupStack(addressOf(account), 'BackupVerification')

        await waitFor(
            () => {
                expect(
                    screen.getByTestId('backup_verification_item_0'),
                ).toBeTruthy()
                expect(
                    screen.getByTestId('backup_verification_item_2'),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )

        // For every item, pick the first option that is provably not
        // the correct word for that position. The submit then routes
        // through the wrong branch of `useBackupQuiz.onSubmit`, which
        // rebuilds the items and fires `onWrong` rather than calling
        // `onSuccess`.
        for (let i = 0; i < 3; i++) {
            const item = screen.getByTestId(`backup_verification_item_${i}`)
            const correctWord = ALGO25_TEST_MNEMONIC_WORDS[positionOf(item)]
            const wrong = optionWords(item).find(w => w !== correctWord)
            if (!wrong) {
                throw new Error(
                    `No incorrect option offered for item ${i}; quiz only generated the correct word`,
                )
            }
            fireEvent.click(optionFor(item, wrong))
        }

        fireEvent.click(screen.getByTestId('backup_verification_next'))

        // The wrong branch's error toast is the signal the submit has settled.
        await waitFor(() =>
            expect(vi.mocked(Notifier.showNotification)).toHaveBeenCalled(),
        )
        expect(screen.queryByTestId('backup_success_done')).toBeNull()
        expect(screen.getByTestId('backup_verification_next')).toBeTruthy()
        expect(
            useMnemonicBackupStore.getState().isBackedUp(seedOf(account)!),
        ).toBe(false)
    })

    it('Given a PIN is configured, when the user lands on the BackupMnemonic screen, then the PIN gate mounts and the mnemonic stays hidden until the PIN is verified', async () => {
        const account = await seedAlgo25Account()

        // Configure the PIN before navigating to the screen.
        // `BackupReminderMnemonicScreen` asks for the PIN through the
        // shared PIN gate before pulling the mnemonic into memory, as a
        // defense-in-depth that doesn't rely on the
        // upstream WriteDown step having gated first.
        const TEST_PIN = '123456'
        const { result: pinHook } = renderHook(() => usePinCode())
        await act(async () => {
            await pinHook.current.savePin(TEST_PIN)
            expect(await pinHook.current.checkPinEnabled()).toBe(true)
        })

        renderBackupStack(addressOf(account), 'BackupMnemonic')

        // The PIN numpad mounts in front of the words grid. The
        // continue CTA is absent (the grid renders only after the
        // gate resolves), and no mnemonic word leaks through behind
        // the gate.
        await waitFor(() => {
            expect(screen.getByTestId('numpad_key_0')).toBeTruthy()
        })
        expect(screen.queryByTestId('backup_mnemonic_continue')).toBeNull()
        for (const word of ALGO25_TEST_MNEMONIC_WORDS) {
            expect(screen.queryAllByText(word).length).toBe(0)
        }
    })
})
