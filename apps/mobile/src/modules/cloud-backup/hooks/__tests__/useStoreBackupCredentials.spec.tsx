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
import { renderHook } from '@testing-library/react'
import { ICloudUnavailableError } from '../../storage/errors'
import { useStoreBackupCredentials } from '../useStoreBackupCredentials'

const {
    mockRequest,
    mockRequirePin,
    mockShowToast,
    mockShowError,
    mockLoggerError,
    saveToDevice,
    saveToICloud,
    saveToGoogleDrive,
    storeState,
} = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockRequirePin: vi.fn(),
    mockShowToast: vi.fn(),
    mockShowError: vi.fn(),
    mockLoggerError: vi.fn(),
    saveToDevice: vi.fn(),
    saveToICloud: vi.fn(),
    saveToGoogleDrive: vi.fn(),
    storeState: {
        salt: null as string | null,
        backupId: null as string | null,
    },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    backupCredentialsFileName: (backupId: string) =>
        `pera-backup-${backupId.replace('did:pera:', '').slice(0, 5)}.json`,
    buildBackupCredentialsFile: (salt: string) => `file(${salt})`,
    useCloudBackupStore: { getState: () => storeState },
}))
// errors.ts extends AppError from this package, so the real exports (not the
// global unit-test stub) must survive here — only logger is overridden.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    logger: { error: mockLoggerError },
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mockRequirePin,
    }),
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))
vi.mock('../../components/StoreBackupCredentialsSheet', () => ({
    StoreBackupCredentialsSheet: () => null,
}))
vi.mock('../../storage', () => ({
    saveToDevice,
    saveToICloud,
    saveToGoogleDrive,
}))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}`
const FILE_NAME = 'pera-backup-VQBGR.json'

beforeEach(() => {
    vi.clearAllMocks()
    storeState.salt = SALT
    storeState.backupId = BACKUP_ID
    mockRequest.mockResolvedValue('device')
    mockRequirePin.mockResolvedValue(true)
    saveToDevice.mockResolvedValue('saved')
    saveToICloud.mockResolvedValue('saved')
    saveToGoogleDrive.mockResolvedValue('saved')
})

const store = async (options?: { hasVerifiedPin?: boolean }) => {
    const { result } = renderHook(() => useStoreBackupCredentials())
    await result.current.storeCredentials(options)
}

describe('useStoreBackupCredentials', () => {
    test('shows an error and opens nothing when no backup is stored', async () => {
        storeState.salt = null
        storeState.backupId = null

        await store()

        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'cloud_backup.store_credentials.error',
        )
        expect(mockRequest).not.toHaveBeenCalled()
    })

    test('does nothing when the sheet is dismissed', async () => {
        mockRequest.mockResolvedValueOnce(undefined)

        await store()

        expect(mockRequirePin).not.toHaveBeenCalled()
        expect(saveToDevice).not.toHaveBeenCalled()
    })

    test('asks for the PIN only after a destination is chosen', async () => {
        await store()

        expect(mockRequest.mock.invocationCallOrder[0]).toBeLessThan(
            mockRequirePin.mock.invocationCallOrder[0],
        )
    })

    test('trusts a caller that has just verified the PIN', async () => {
        await store({ hasVerifiedPin: true })

        expect(mockRequirePin).not.toHaveBeenCalled()
        expect(saveToDevice).toHaveBeenCalledWith(FILE_NAME, expect.any(String))
    })

    test('saves nothing when PIN verification fails', async () => {
        mockRequirePin.mockResolvedValueOnce(false)

        await store()

        expect(saveToDevice).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    test('stops when the backup is reset while the sheet and PIN are open', async () => {
        mockRequirePin.mockImplementationOnce(async () => {
            storeState.salt = null
            return true
        })

        await store()

        expect(saveToDevice).not.toHaveBeenCalled()
        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'cloud_backup.store_credentials.error',
        )
    })

    test('ignores a second call while one is in flight', async () => {
        let resolveSheet: (value: string | undefined) => void = () => {}
        mockRequest.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveSheet = resolve
                }),
        )
        const { result } = renderHook(() => useStoreBackupCredentials())

        const first = result.current.storeCredentials()
        await result.current.storeCredentials()
        resolveSheet(undefined)
        await first

        expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    test.each([
        ['device', saveToDevice],
        ['icloud', saveToICloud],
        ['googleDrive', saveToGoogleDrive],
    ] as const)(
        'saves the file through the %s saver and confirms',
        async (destination, saver) => {
            mockRequest.mockResolvedValueOnce(destination)

            await store()

            expect(saver).toHaveBeenCalledWith(FILE_NAME, `file(${SALT})`)
            expect(mockShowToast).toHaveBeenCalledWith(
                {
                    title: 'cloud_backup.store_credentials.success',
                    body: '',
                    type: 'success',
                },
                { delayLength: 'short' },
            )
        },
    )

    test('stays silent when the user backs out inside the destination', async () => {
        mockRequest.mockResolvedValueOnce('googleDrive')
        saveToGoogleDrive.mockResolvedValueOnce('cancelled')

        await store()

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockShowError).not.toHaveBeenCalled()
    })

    test('passes a destination error through so it can show its own copy', async () => {
        mockRequest.mockResolvedValueOnce('icloud')
        const error = new ICloudUnavailableError()
        saveToICloud.mockRejectedValueOnce(error)

        await store()

        expect(mockShowError).toHaveBeenCalledWith(
            error,
            'cloud_backup.store_credentials.error',
        )
    })

    test('shows the generic error for any other failure', async () => {
        const error = new Error('disk full')
        saveToDevice.mockRejectedValueOnce(error)

        await store()

        expect(mockShowError).toHaveBeenCalledWith(
            error,
            'cloud_backup.store_credentials.error',
        )
        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ destination: 'device', error }),
        )
        expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain(SALT)
    })
})
