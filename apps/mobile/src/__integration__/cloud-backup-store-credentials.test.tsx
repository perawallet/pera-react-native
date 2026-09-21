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
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import Share from 'react-native-share'
import { Notifier } from 'react-native-notifier'
import { File } from 'expo-file-system'

import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    deleteBackupKeys,
    persistBackupKeys,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { usePinCode } from '@perawallet/wallet-core-security'

import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const TEST_PIN = '123456'
// Named after the backup's own address, so a second backup saves beside it.
const FILE_NAME = 'pera-backup-CREDE.json'
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
    await waitFor(async () => {
        await result.current.savePin(TEST_PIN)
        expect(await result.current.checkPinEnabled()).toBe(true)
    })
}

const enterPin = async (): Promise<void> => {
    await waitFor(() => expect(screen.getByTestId('PWNumpad')).toBeTruthy())
    for (const digit of TEST_PIN) {
        await act(async () => {
            fireEvent.click(
                within(screen.getByTestId('PWNumpad')).getByText(digit),
            )
        })
    }
}

const toastTitles = (): string[] =>
    vi
        .mocked(Notifier.showNotification)
        .mock.calls.map(call => String(call[0].title))

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterAll(() => server.close())

beforeEach(async () => {
    resetTestKeystore()
    useDeviceStore.getState().setDeviceID('mainnet', 'device-integration')
    useDeviceStore.getState().setDeviceID('testnet', 'device-integration')
    useCloudBackupStore.getState().resetState()
    await persistBackupKeys({
        encryptionKey: new Uint8Array(32).fill(1),
        authSecretKey: new Uint8Array(64).fill(2),
        mnemonic: PHRASE,
    })
    useCloudBackupStore.getState().setConfigured({
        backupId: 'did:pera:CREDENTIALADDRESS',
        salt: SALT,
        deviceId: 'device-integration',
    })
})

afterEach(async () => {
    server.resetHandlers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    await deleteBackupKeys()
})

describe('storing backup credentials', () => {
    it('takes the PIN once, saves the key file to the device and confirms', async () => {
        const write = vi.spyOn(File.prototype, 'write')
        await seedPin()
        renderWithNavigation(CloudBackupOverviewScreen, 'CloudBackupOverview')

        fireEvent.click(
            await screen.findByTestId(
                'cloud_backup_overview_credential_address',
            ),
        )
        await enterPin()

        fireEvent.click(
            await screen.findByTestId('backup_credentials_done_button'),
        )
        fireEvent.click(
            await screen.findByTestId('store_backup_credentials_local'),
        )

        // No second PIN: this entry point already took one before the
        // credentials sheet that led here.
        await waitFor(() =>
            expect(Share.open).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining(FILE_NAME),
                    saveToFiles: true,
                }),
            ),
        )
        // The success toast waits a short delay so a dismissing native sheet can clear.
        await waitFor(
            () =>
                expect(toastTitles()).toContain(
                    'cloud_backup.store_credentials.success',
                ),
            { timeout: 5000 },
        )

        const saved = String(write.mock.calls[0]?.[0])
        expect(JSON.parse(saved)).toMatchObject({
            t: 'backup-credentials',
            salt: SALT,
        })
        expect(PHRASE.some(word => saved.includes(word))).toBe(false)
    })

    it('saves nothing and asks for no second PIN when the store sheet is closed', async () => {
        await seedPin()
        renderWithNavigation(CloudBackupOverviewScreen, 'CloudBackupOverview')

        fireEvent.click(
            await screen.findByTestId(
                'cloud_backup_overview_credential_address',
            ),
        )
        await enterPin()
        fireEvent.click(
            await screen.findByTestId('backup_credentials_done_button'),
        )
        fireEvent.click(
            await screen.findByTestId(
                'store_backup_credentials_sheet_header-close',
            ),
        )

        await waitFor(() =>
            expect(
                screen.queryByTestId('store_backup_credentials_sheet'),
            ).toBeNull(),
        )
        // Outlast the success toast's short delay, so a flow that kept going
        // would have shown its PIN prompt or toast by now.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 500))
        })
        expect(screen.queryByTestId('PWNumpad')).toBeNull()
        expect(toastTitles()).toEqual([])
        expect(Share.open).not.toHaveBeenCalled()
    })
})
