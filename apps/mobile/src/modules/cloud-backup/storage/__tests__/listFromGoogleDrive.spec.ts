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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CredentialsFileNotFoundError } from '@perawallet/wallet-core-backup'
import { listFromGoogleDrive } from '../listFromGoogleDrive'

const { runOnGoogleDrive, signOutOfGoogleDrive, readdir } = vi.hoisted(() => ({
    runOnGoogleDrive: vi.fn(),
    signOutOfGoogleDrive: vi.fn(),
    readdir: vi.fn(),
}))

vi.mock('../googleDriveSession', () => ({
    runOnGoogleDrive,
    signOutOfGoogleDrive,
}))

const driveReturning = (entries: string[]) => {
    readdir.mockResolvedValue(entries)
    runOnGoogleDrive.mockImplementation(
        async (operation: (drive: { readdir: typeof readdir }) => unknown) => ({
            status: 'done',
            value: await operation({ readdir }),
        }),
    )
}

beforeEach(() => {
    vi.clearAllMocks()
    signOutOfGoogleDrive.mockResolvedValue(null)
})

describe('listFromGoogleDrive', () => {
    test('returns every saved key, so a user with two backups can pick', async () => {
        driveReturning(['pera-backup-VQBGR.json', 'pera-backup-ZZZZZ.json'])

        await expect(listFromGoogleDrive()).resolves.toEqual({
            status: 'listed',
            fileNames: ['pera-backup-VQBGR.json', 'pera-backup-ZZZZZ.json'],
        })
        expect(readdir).toHaveBeenCalledWith('/')
    })

    test('ignores anything in appDataFolder that is not a key', async () => {
        driveReturning(['other-app.json', 'pera-backup-VQBGR.json'])

        await expect(listFromGoogleDrive()).resolves.toEqual({
            status: 'listed',
            fileNames: ['pera-backup-VQBGR.json'],
        })
    })

    test('signs out when the account holds no key, so another can be picked', async () => {
        driveReturning(['other-app.json'])

        await expect(listFromGoogleDrive()).rejects.toBeInstanceOf(
            CredentialsFileNotFoundError,
        )
        expect(signOutOfGoogleDrive).toHaveBeenCalledTimes(1)
    })

    test('still reports not found when the sign-out itself fails', async () => {
        driveReturning([])
        signOutOfGoogleDrive.mockRejectedValueOnce(new Error('offline'))

        await expect(listFromGoogleDrive()).rejects.toBeInstanceOf(
            CredentialsFileNotFoundError,
        )
    })

    test('passes a cancelled sign-in straight through', async () => {
        runOnGoogleDrive.mockResolvedValueOnce({ status: 'cancelled' })

        await expect(listFromGoogleDrive()).resolves.toEqual({
            status: 'cancelled',
        })
        expect(signOutOfGoogleDrive).not.toHaveBeenCalled()
    })

    test('hands the progress callback to the session', async () => {
        const onListing = vi.fn()
        driveReturning(['pera-backup-VQBGR.json'])

        await listFromGoogleDrive(onListing)

        expect(runOnGoogleDrive).toHaveBeenCalledWith(
            expect.any(Function),
            onListing,
        )
    })
})
