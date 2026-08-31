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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

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

import { CloudBackupSetupScreen } from '@modules/cloud-backup/screens/CloudBackupSetupScreen'
import { CloudBackupVerifyScreen } from '@modules/cloud-backup/screens/CloudBackupVerifyScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'

// Enabling runs the real Argon2 KDF through `deriveBackupKeys`; under jsdom
// that dominates the test. Give it headroom rather than mocking the crypto.
const SLOW_TEST_TIMEOUT_MS = 30_000

// Regex, not a glob: the backup client's ky prefix already ends in `/` and the
// endpoint path starts with one, so the request URL carries a double slash that
// a `*/api/v3/...` pattern misses — and an unmatched handler means MSW lets the
// call reach the real staging host.
const REGISTER_URL = /\/backup\/register$/
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
            { name: 'CloudBackupSetup', component: CloudBackupSetupScreen },
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

const confirmEncryptionKey = async (): Promise<void> => {
    await waitFor(() =>
        expect(
            screen.getByTestId('cloud_backup_confirm_enable_button'),
        ).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId('cloud_backup_confirm_checkbox'))
    fireEvent.click(screen.getByTestId('cloud_backup_confirm_enable_button'))
}

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterAll(() => server.close())

beforeEach(() => {
    useDeviceStore.getState().setDeviceID('mainnet', 'device-integration')
    useDeviceStore.getState().setDeviceID('testnet', 'device-integration')
    useCloudBackupStore.getState().resetState()
    useCloudBackupDraftStore.getState().resetState()
})

afterEach(async () => {
    server.resetHandlers()
    vi.clearAllMocks()
    await deleteBackupKeys()
})

describe('cloud backup setup screen', () => {
    // The Setup -> Verify half stops here: the native stack keeps a
    // pushed-from screen mounted, but the web navigator unmounts it, which
    // fires Setup's cleanup and wipes the draft before Verify can read it.
    // `useCloudBackupSetupScreen.spec.tsx` covers the draft write.
    it('reveals a numbered twelve-word phrase and moves on to verification', async () => {
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

        fireEvent.click(screen.getByTestId('cloud_backup_setup_proceed_button'))

        await waitFor(() =>
            expect(
                screen.getByTestId('cloud_backup_verify_screen'),
            ).toBeTruthy(),
        )
    })

    it('zeroes the draft phrase when the flow is left', async () => {
        seedDraft()
        const draft = useCloudBackupDraftStore.getState().mnemonicIndices!

        useCloudBackupDraftStore.getState().clearDraft()

        expect(Array.from(draft)).toEqual(Array(12).fill(0))
        expect(useCloudBackupDraftStore.getState().mnemonicIndices).toBeNull()
    })
})

describe('cloud backup verification and enable', () => {
    it(
        'registers the backup and marks it configured',
        async () => {
            const registered = vi.fn()
            server.use(
                http.post(REGISTER_URL, async ({ request }) => {
                    registered(await request.json())
                    return HttpResponse.json({ ok: true })
                }),
            )
            seedDraft()
            renderVerifyFlow()

            await answerQuizCorrectly()
            fireEvent.click(
                screen.getByTestId('cloud_backup_verify_proceed_button'),
            )
            await confirmEncryptionKey()

            await waitFor(
                () =>
                    expect(useCloudBackupStore.getState().isConfigured()).toBe(
                        true,
                    ),
                { timeout: SLOW_TEST_TIMEOUT_MS },
            )
            expect(useCloudBackupStore.getState().salt).toBe(SALT)
            // The backup id is derived from the phrase, not handed back by the
            // server, so assert the shape and that it reached registration.
            const backupId = useCloudBackupStore.getState().backupId!
            expect(backupId).toMatch(/^did:pera:[A-Z2-7]+$/)
            expect(registered).toHaveBeenCalledTimes(1)
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

            // Success clears the draft rather than leaving it in the store.
            expect(
                useCloudBackupDraftStore.getState().mnemonicIndices,
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'leaves nothing configured or persisted when registration fails',
        async () => {
            const attempted = vi.fn()
            server.use(
                http.post(REGISTER_URL, () => {
                    attempted()
                    return new HttpResponse(null, { status: 500 })
                }),
            )
            seedDraft()
            renderVerifyFlow()

            await answerQuizCorrectly()
            fireEvent.click(
                screen.getByTestId('cloud_backup_verify_proceed_button'),
            )
            await confirmEncryptionKey()

            await waitFor(() => expect(attempted).toHaveBeenCalled(), {
                timeout: SLOW_TEST_TIMEOUT_MS,
            })
            // Assert the absence explicitly rather than reading the store once:
            // `isConfigured()` is already false the moment the flow starts, so
            // a bare expectation passes at t=0 and proves nothing. This fails
            // if registration ever quietly succeeds.
            await expect(
                waitFor(
                    () =>
                        expect(
                            useCloudBackupStore.getState().isConfigured(),
                        ).toBe(true),
                    { timeout: 2000 },
                ),
            ).rejects.toThrow()
            // Credentials never validated, so the half-written keys are gone.
            expect(
                await withBackupMnemonicIndices(i => Array.from(i)),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'sends the user back to the phrase when they ask to see it again',
        async () => {
            seedDraft()
            renderVerifyFlow()

            await answerQuizCorrectly()
            fireEvent.click(
                screen.getByTestId('cloud_backup_verify_proceed_button'),
            )

            await waitFor(() =>
                expect(
                    screen.getByTestId(
                        'cloud_backup_confirm_show_again_button',
                    ),
                ).toBeTruthy(),
            )
            fireEvent.click(
                screen.getByTestId('cloud_backup_confirm_show_again_button'),
            )

            await waitFor(() =>
                expect(
                    screen.getByTestId('cloud_backup_setup_screen'),
                ).toBeTruthy(),
            )
            expect(useCloudBackupStore.getState().isConfigured()).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
