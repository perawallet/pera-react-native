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

// Side-effect import: the quiz is driven off each item's "Select word #N"
// label, which renders as the raw i18n key without the English resources.
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
import { Notifier } from 'react-native-notifier'

import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    deleteBackupKeys,
    persistBackupKeys,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { usePinCode } from '@perawallet/wallet-core-security'

import { CloudBackupConfirmCredentialsScreen } from '@modules/cloud-backup/screens/CloudBackupConfirmCredentialsScreen'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'

import {
    PIN_FLOW_TEST_TIMEOUT_MS,
    SLOW_WAIT_TIMEOUT_MS,
} from './__fixtures__/timeouts'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const TEST_PIN = '123456'
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

const seedPin = async (): Promise<void> => {
    const { result } = renderHook(() => usePinCode())
    await act(async () => {
        await result.current.savePin(TEST_PIN)
        expect(await result.current.checkPinEnabled()).toBe(true)
    })
}

const enterPin = async (): Promise<void> => {
    await waitFor(() => expect(screen.getByTestId('numpad_key_0')).toBeTruthy())
    for (const digit of TEST_PIN) {
        await act(async () => {
            fireEvent.click(screen.getByTestId(`numpad_key_${digit}`))
        })
    }
}

const toastTitles = (): string[] =>
    vi
        .mocked(Notifier.showNotification)
        .mock.calls.map(call => String(call[0].title))

const renderOverview = () =>
    renderWithNavigation(CloudBackupOverviewScreen, 'CloudBackupOverview', {
        additionalScreens: [
            {
                name: 'CloudBackupConfirmCredentials',
                component: CloudBackupConfirmCredentialsScreen,
            },
        ],
    })

const quizItems = (): HTMLElement[] => {
    const items: HTMLElement[] = []
    for (let index = 0; ; index++) {
        const item = screen.queryByTestId(
            `cloud_backup_confirm_credentials_item_${index}`,
        )
        if (!item) break
        items.push(item)
    }
    return items
}

const answerQuiz = (): void => {
    quizItems().forEach((item, index) => {
        const label = within(item).getByText(/^Select word #\d+$/)
        const position = Number(/#(\d+)/.exec(label.textContent ?? '')![1]) - 1
        const option = within(item)
            .getAllByTestId(
                new RegExp(
                    `^cloud_backup_confirm_credentials_item_${index}_option_`,
                ),
            )
            .find(candidate => candidate.textContent === PHRASE[position])
        fireEvent.click(option!)
    })
}

const openConfirmScreen = async (): Promise<void> => {
    await seedPin()
    renderOverview()
    fireEvent.click(
        await screen.findByTestId('cloud_backup_overview_confirm_credentials'),
    )
    await enterPin()
    await waitFor(
        () =>
            expect(
                screen.getByTestId('cloud_backup_confirm_credentials_item_0'),
            ).toBeTruthy(),
        { timeout: SLOW_WAIT_TIMEOUT_MS },
    )
}

const typeKey = (value: string): void => {
    fireEvent.change(
        screen.getByTestId('cloud_backup_confirm_credentials_key_input'),
        { target: { value } },
    )
}

const configure = (credentialsConfirmed: boolean): void =>
    useCloudBackupStore.getState().setConfigured({
        backupId: 'did:pera:CREDENTIALADDRESS',
        salt: SALT,
        deviceId: 'device-integration',
        credentialsConfirmed,
    })

beforeEach(async () => {
    resetTestKeystore()
    useDeviceStore.getState().setDeviceID('live', 'device-integration')
    useDeviceStore.getState().setDeviceID('developer', 'device-integration')
    useCloudBackupStore.getState().resetState()
    await persistBackupKeys({
        encryptionKey: new Uint8Array(32).fill(1),
        authSecretKey: new Uint8Array(64).fill(2),
        itemKey: new Uint8Array(32).fill(3),
        mnemonic: PHRASE,
    })
})

afterEach(async () => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    await deleteBackupKeys()
})

describe('confirming the backup credentials', () => {
    it(
        'shows one warning, then clears it once the words and the encryption key are right',
        async () => {
            configure(false)
            await openConfirmScreen()

            answerQuiz()
            typeKey(SALT)
            fireEvent.click(
                screen.getByTestId('cloud_backup_confirm_credentials_button'),
            )

            await waitFor(() =>
                expect(
                    useCloudBackupStore.getState().credentialsConfirmed,
                ).toBe(true),
            )
            expect(toastTitles()).toContain('Backup key confirmed')
            await waitFor(() =>
                expect(
                    screen.getByTestId('cloud_backup_overview_screen'),
                ).toBeTruthy(),
            )
            expect(
                screen.queryAllByTestId(
                    'cloud_backup_overview_confirm_credentials',
                ),
            ).toHaveLength(0)
        },
        PIN_FLOW_TEST_TIMEOUT_MS,
    )

    it(
        'keeps the credentials unconfirmed and stays on the screen when the encryption key is wrong',
        async () => {
            configure(false)
            await openConfirmScreen()

            answerQuiz()
            typeKey('d3Jvbmcta2V5')
            fireEvent.click(
                screen.getByTestId('cloud_backup_confirm_credentials_button'),
            )

            await waitFor(() =>
                expect(toastTitles()).toContain(
                    'This encryption key doesn’t match your backup.',
                ),
            )
            expect(useCloudBackupStore.getState().credentialsConfirmed).toBe(
                false,
            )
            expect(
                screen.getByTestId('cloud_backup_confirm_credentials_screen'),
            ).toBeTruthy()
        },
        PIN_FLOW_TEST_TIMEOUT_MS,
    )

    it('shows no warning for a confirmed backup', async () => {
        configure(true)
        renderOverview()

        await screen.findByTestId('cloud_backup_overview_screen')

        expect(
            screen.queryAllByTestId(
                'cloud_backup_overview_confirm_credentials',
            ),
        ).toHaveLength(0)
    })
})
