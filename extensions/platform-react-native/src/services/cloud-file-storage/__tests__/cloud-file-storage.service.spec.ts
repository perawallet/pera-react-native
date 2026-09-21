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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Platform } from 'react-native'
import { RNCloudFileStorageService } from '../cloud-file-storage.service'

const drive = vi.hoisted(() => ({
    isGoogleDriveConfigured: vi.fn(),
    saveToGoogleDrive: vi.fn(),
    readFromGoogleDrive: vi.fn(),
}))
const icloud = vi.hoisted(() => ({
    saveToICloud: vi.fn(),
    readFromICloud: vi.fn(),
}))

vi.mock('../google-drive', () => drive)
vi.mock('../icloud', () => icloud)

const FILE_NAME = 'pera-backup-VQBGR.json'
const CONTENTS = '{"t":"backup-credentials"}'
const options = { isCandidate: () => true, chooseFile: async () => null }

// The mock types OS as the two mobile platforms; a desktop build is the case
// this list has to keep empty.
const setOS = (os: string) => {
    ;(Platform as { OS: string }).OS = os
}

const originalOS = Platform.OS
const service = new RNCloudFileStorageService()

beforeEach(() => {
    vi.clearAllMocks()
    drive.isGoogleDriveConfigured.mockReturnValue(true)
    drive.saveToGoogleDrive.mockResolvedValue('saved')
    drive.readFromGoogleDrive.mockResolvedValue({
        status: 'read',
        contents: CONTENTS,
    })
    icloud.saveToICloud.mockResolvedValue('saved')
    icloud.readFromICloud.mockResolvedValue({
        status: 'read',
        contents: CONTENTS,
    })
})

afterEach(() => {
    setOS(originalOS)
})

describe('RNCloudFileStorageService.getAvailableStores', () => {
    test('offers iCloud first on iOS, the only platform with an iCloud client', () => {
        setOS('ios')

        expect(service.getAvailableStores()).toEqual(['icloud', 'googleDrive'])
    })

    test('drops iCloud on Android', () => {
        setOS('android')

        expect(service.getAvailableStores()).toEqual(['googleDrive'])
    })

    // Neither native SDK ships outside the two mobile builds, so the list must
    // never leak a store that would throw the moment it is tapped.
    test('offers nothing on a platform with neither SDK', () => {
        setOS('windows')

        expect(service.getAvailableStores()).toEqual([])
    })

    // Tapping the row on such a build throws, and that throw reports as a bug
    // from a healthy device.
    test('drops Drive on a build with no OAuth client, keeping iCloud', () => {
        setOS('ios')
        drive.isGoogleDriveConfigured.mockReturnValue(false)

        expect(service.getAvailableStores()).toEqual(['icloud'])
    })

    test('offers nothing on Android when the build has no OAuth client', () => {
        setOS('android')
        drive.isGoogleDriveConfigured.mockReturnValue(false)

        expect(service.getAvailableStores()).toEqual([])
    })
})

describe('RNCloudFileStorageService routing', () => {
    test('saves to the Drive appDataFolder', async () => {
        await expect(
            service.save('googleDrive', FILE_NAME, CONTENTS),
        ).resolves.toBe('saved')

        expect(drive.saveToGoogleDrive).toHaveBeenCalledWith(
            FILE_NAME,
            CONTENTS,
        )
        expect(icloud.saveToICloud).not.toHaveBeenCalled()
    })

    test('saves to the iCloud container', async () => {
        await service.save('icloud', FILE_NAME, CONTENTS)

        expect(icloud.saveToICloud).toHaveBeenCalledWith(FILE_NAME, CONTENTS)
        expect(drive.saveToGoogleDrive).not.toHaveBeenCalled()
    })

    test('reads from the Drive appDataFolder', async () => {
        await expect(service.read('googleDrive', options)).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })

        expect(drive.readFromGoogleDrive).toHaveBeenCalledWith(options)
        expect(icloud.readFromICloud).not.toHaveBeenCalled()
    })

    test('reads from the iCloud container', async () => {
        await service.read('icloud', options)

        expect(icloud.readFromICloud).toHaveBeenCalledWith(options)
        expect(drive.readFromGoogleDrive).not.toHaveBeenCalled()
    })
})
