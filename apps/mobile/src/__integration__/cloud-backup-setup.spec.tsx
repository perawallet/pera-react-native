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
// resources. The quiz is driven off each item's "Select word #N" label to
// recover which position is being asked for — without translations that label
// renders as the raw i18n key and the lookup falls apart.
import '../i18n'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'

import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'
import {
    deleteBackupKeys,
    useCloudBackupDraftStore,
    useCloudBackupStore,
    withBackupMnemonicIndices,
} from '@perawallet/wallet-core-backup'
import { buildRegisterHandler } from '@perawallet/wallet-core-backup/test-handlers'
import { usePinCode } from '@perawallet/wallet-core-security'

import { CloudBackupSetupScreen } from '@modules/cloud-backup/screens/CloudBackupSetupScreen'
import { CloudBackupVerifyScreen } from '@modules/cloud-backup/screens/CloudBackupVerifyScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'
import { CloudBackupStoreEncryptionKeyScreen } from '@modules/cloud-backup/screens/CloudBackupStoreEncryptionKeyScreen'
import { isElementDisabled } from '@test-utils/rnw'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

// Any twelve wordlist words: the cloud-backup KDF hashes the phrase and never
// checks a BIP39 checksum, so these don't need to form a valid mnemonic.
const PHRASE = [
    'marble',
    'protect',
    'crawl',
    'steak',
    'lion',
    'clock',
    'enemy',
    'milk',
    'venue',
    'cereal',
    'roast',
    'wealth',
]

// The Setup -> Verify handoff writes this; seeding it directly lets the
// verify/enable half of the flow run without depending on Setup staying
// mounted, which the web navigator doesn't reproduce (see the note on the
// setup test below).
const seedDraft = () =>
    useCloudBackupDraftStore.getState().setDraft({
        mnemonicIndices: mnemonicWordsToIndices(PHRASE)!,
        salt: SALT,
    })

const renderVerifyFlow = () =>
    renderWithNavigation(CloudBackupVerifyScreen, 'CloudBackupVerify', {
        additionalScreens: [
            {
                name: 'CloudBackupOverview',
                component: CloudBackupOverviewScreen,
            },
            {
                name: 'CloudBackupStoreEncryptionKey',
                component: CloudBackupStoreEncryptionKeyScreen,
            },
        ],
    })

const answerQuizCorrectly = async (): Promise<void> => {
    await waitFor(() =>
        expect(screen.getByTestId('cloud_backup_verify_item_0')).toBeTruthy(),
    )

    for (let index = 0; ; index++) {
        const item = screen.queryByTestId(`cloud_backup_verify_item_${index}`)
        if (!item) break
        // The position label is the only thing on screen saying *which* word is
        // being asked for — the item testID is just the array index.
        const label = within(item).getByText(/^Select word #\d+$/)
        const position = Number(/#(\d+)/.exec(label.textContent ?? '')![1]) - 1
        fireEvent.click(
            within(item).getByTestId(
                `cloud_backup_verify_item_${index}_option_${PHRASE[position]}`,
            ),
        )
    }
}

const positionAskedBy = (item: HTMLElement): number => {
    // The position label is the only thing on screen saying *which* word is
    // being asked for — the item testID is just the array index.
    const label = within(item).getByText(/^Select word #\d+$/)
    return Number(/#(\d+)/.exec(label.textContent ?? '')![1]) - 1
}

const quizItems = (): HTMLElement[] => {
    const items: HTMLElement[] = []
    for (let index = 0; ; index++) {
        const item = screen.queryByTestId(`cloud_backup_verify_item_${index}`)
        if (!item) break
        items.push(item)
    }
    return items
}

const askedPositions = (): number[] => quizItems().map(positionAskedBy)

const answerQuizIncorrectly = (): void => {
    quizItems().forEach((item, index) => {
        const correctWord = PHRASE[positionAskedBy(item)]
        const wrongOption = within(item)
            .getAllByTestId(
                new RegExp(`^cloud_backup_verify_item_${index}_option_`),
            )
            .find(option => option.textContent !== correctWord)
        fireEvent.click(wrongOption!)
    })
}

const enableFromStoreKeyScreen = async (): Promise<void> => {
    await waitFor(() =>
        expect(
            screen.getByTestId('cloud_backup_store_encryption_key_screen'),
        ).toBeTruthy(),
    )
    fireEvent.click(
        screen.getByTestId('cloud_backup_store_encryption_key_checkbox'),
    )
    fireEvent.click(
        screen.getByTestId('cloud_backup_store_encryption_key_enable_button'),
    )
}

const TEST_PIN = '123456'

const seedPin = async (): Promise<void> => {
    const { result } = renderHook(() => usePinCode())
    await waitFor(async () => {
        await result.current.savePin(TEST_PIN)
        expect(await result.current.checkPinEnabled()).toBe(true)
    })
}

const enterPin = async (pin: string): Promise<void> => {
    for (const digit of pin) {
        await act(async () => {
            fireEvent.click(screen.getByTestId(`numpad_key_${digit}`))
        })
    }
}

beforeEach(() => {
    // Also wipes the PIN, so a PIN test can't gate the tests after it.
    resetTestKeystore()
    useDeviceStore.getState().setDeviceID('mainnet', 'device-integration')
    useDeviceStore.getState().setDeviceID('testnet', 'device-integration')
    useCloudBackupStore.getState().resetState()
    useCloudBackupDraftStore.getState().resetState()
})

afterEach(async () => {
    vi.clearAllMocks()
    await deleteBackupKeys()
})

describe('cloud backup setup screen', () => {
    // The Setup -> Verify half stops here: the native stack keeps a
    // pushed-from screen mounted, but the web navigator unmounts it, which
    // fires Setup's cleanup and wipes the draft before Verify can read it.
    // `useCloudBackupSetupScreen.spec.tsx` covers the draft write.
    it('reveals a numbered twelve-word phrase, holds Proceed until the phrase is confirmed stored, moves on to verification and leaves no draft behind', async () => {
        renderWithNavigation(CloudBackupSetupScreen, 'CloudBackupSetup', {
            additionalScreens: [
                {
                    name: 'CloudBackupVerify',
                    component: CloudBackupVerifyScreen,
                },
            ],
        })

        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_setup_screen'),
            ).toBeTruthy(),
        )
        for (let position = 1; position <= 12; position++) {
            expect(screen.getByText(String(position))).toBeTruthy()
        }
        expect(screen.queryByText('13')).toBeNull()

        const proceed = () =>
            screen.getByTestId('cloud_backup_setup_proceed_button')
        expect(isElementDisabled(proceed())).toBe(true)

        fireEvent.click(screen.getByTestId('cloud_backup_setup_checkbox'))
        await waitFor(() => expect(isElementDisabled(proceed())).toBe(false))
        fireEvent.click(proceed())

        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_verify_screen'),
            ).toBeTruthy(),
        )
        // Leaving Setup runs its unmount cleanup, so nothing readable is left
        // in the draft store. `draftStore.spec.ts` covers the buffer zeroing.
        await waitFor(() =>
            expect(
                useCloudBackupDraftStore.getState().mnemonicIndices,
            ).toBeNull(),
        )
    })
})

describe('cloud backup verification and enable', () => {
    it('registers at the quiz without writing anything to the device', async () => {
        const registered = vi.fn()
        server.use(buildRegisterHandler({ onRegister: registered }))
        seedDraft()
        renderVerifyFlow()

        await answerQuizCorrectly()
        fireEvent.click(
            screen.getByTestId('cloud_backup_verify_proceed_button'),
        )

        await waitFor(() => expect(registered).toHaveBeenCalledTimes(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_store_encryption_key_screen'),
            ).toBeTruthy(),
        )

        // The consent boundary: registered, but nothing is on the device.
        expect(useCloudBackupStore.getState().isConfigured()).toBe(false)
        expect(await withBackupMnemonicIndices(i => Array.from(i))).toBeNull()
    })

    it('stores the keys and marks the backup configured only once enable is pressed', async () => {
        const registered = vi.fn()
        server.use(buildRegisterHandler({ onRegister: registered }))
        seedDraft()
        renderVerifyFlow()

        await answerQuizCorrectly()
        fireEvent.click(
            screen.getByTestId('cloud_backup_verify_proceed_button'),
        )
        await enableFromStoreKeyScreen()

        await waitFor(
            () =>
                expect(useCloudBackupStore.getState().isConfigured()).toBe(
                    true,
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(useCloudBackupStore.getState().salt).toBe(SALT)
        // The backup id is derived from the phrase, not handed back by the
        // server.
        const backupId = useCloudBackupStore.getState().backupId!
        expect(backupId).toMatch(/^did:pera:[A-Z2-7]+$/)
        expect(registered).toHaveBeenCalledWith(
            expect.objectContaining({
                backup_id: backupId,
                device_id: 'device-integration',
            }),
        )

        // The phrase the user just verified is the one we persisted.
        const stored = await withBackupMnemonicIndices(indices =>
            Array.from(indices),
        )
        expect(stored).toEqual(Array.from(mnemonicWordsToIndices(PHRASE)!))
        expect(useCloudBackupDraftStore.getState().mnemonicIndices).toBeNull()

        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_overview_screen'),
            ).toBeTruthy(),
        )
        expect(registered).toHaveBeenCalledTimes(1)
    })

    it('leaves nothing configured or persisted when registration fails', async () => {
        const attempted = vi.fn()
        server.use(buildRegisterHandler({ onRegister: attempted, status: 500 }))
        seedDraft()
        renderVerifyFlow()

        await answerQuizCorrectly()
        fireEvent.click(
            screen.getByTestId('cloud_backup_verify_proceed_button'),
        )

        await waitFor(() => expect(attempted).toHaveBeenCalled(), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        // Assert the absence explicitly rather than reading the store once:
        // `isConfigured()` is already false the moment the flow starts, so
        // a bare expectation passes at t=0 and proves nothing. This fails
        // if registration ever quietly succeeds.
        await expect(
            waitFor(
                () =>
                    expect(useCloudBackupStore.getState().isConfigured()).toBe(
                        true,
                    ),
                { timeout: 2000 },
            ),
        ).rejects.toThrow()
        expect(await withBackupMnemonicIndices(i => Array.from(i))).toBeNull()
        expect(
            screen.queryByTestId('cloud_backup_store_encryption_key_screen'),
        ).toBeNull()
    })

    it('re-samples which words it asks for after a wrong answer', async () => {
        seedDraft()
        renderVerifyFlow()

        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_verify_item_0'),
            ).toBeTruthy(),
        )
        const before = askedPositions()

        // Positions are drawn at random, so one re-roll can coincidentally
        // land on the same three. A few wrong answers is enough to prove
        // they aren't pinned, which is what makes the quiz grindable.
        let changed = false
        for (let attempt = 0; attempt < 3 && !changed; attempt++) {
            answerQuizIncorrectly()
            fireEvent.click(
                screen.getByTestId('cloud_backup_verify_proceed_button'),
            )
            await waitFor(() =>
                expect(askedPositions()).toHaveLength(before.length),
            )
            changed = askedPositions().join() !== before.join()
        }

        expect(changed).toBe(true)
    })
})

describe('cloud backup enable with a PIN set', () => {
    it('asks for the PIN before storing keys, and stores nothing when the PIN sheet is closed', async () => {
        const registered = vi.fn()
        server.use(buildRegisterHandler({ onRegister: registered }))
        await seedPin()
        seedDraft()
        renderVerifyFlow()

        await answerQuizCorrectly()
        fireEvent.click(
            screen.getByTestId('cloud_backup_verify_proceed_button'),
        )
        // Registration is not PIN-gated: it writes nothing locally.
        await waitFor(() => expect(registered).toHaveBeenCalledTimes(1), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        await enableFromStoreKeyScreen()

        await waitFor(() =>
            expect(screen.getByTestId('numpad_key_0')).toBeTruthy(),
        )
        fireEvent.click(screen.getByTestId('close-button'))
        await waitFor(() =>
            expect(screen.queryByTestId('numpad_key_0')).toBeNull(),
        )

        expect(await withBackupMnemonicIndices(i => Array.from(i))).toBeNull()
        expect(useCloudBackupStore.getState().isConfigured()).toBe(false)
        expect(
            screen.getByTestId(
                'cloud_backup_store_encryption_key_enable_button',
            ),
        ).toBeTruthy()
    })

    it('configures the backup once the correct PIN is entered', async () => {
        server.use(buildRegisterHandler())
        await seedPin()
        seedDraft()
        renderVerifyFlow()

        await answerQuizCorrectly()
        fireEvent.click(
            screen.getByTestId('cloud_backup_verify_proceed_button'),
        )
        await enableFromStoreKeyScreen()
        await waitFor(() =>
            expect(screen.getByTestId('numpad_key_0')).toBeTruthy(),
        )

        await enterPin(TEST_PIN)

        await waitFor(
            () =>
                expect(useCloudBackupStore.getState().isConfigured()).toBe(
                    true,
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_overview_screen'),
            ).toBeTruthy(),
        )
        await expect(
            waitFor(
                () =>
                    expect(
                        screen.getByTestId('store_backup_credentials_sheet'),
                    ).toBeTruthy(),
                { timeout: 2000 },
            ),
        ).rejects.toThrow()
    })
})
