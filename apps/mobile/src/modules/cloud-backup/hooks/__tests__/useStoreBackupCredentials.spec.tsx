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
import { ICloudUnavailableError } from '@perawallet/wallet-core-backup'
import { renderHook } from '@testing-library/react'
import { useStoreBackupCredentials } from '../useStoreBackupCredentials'

const {
    mockRequest,
    mockRequirePin,
    mockShowToast,
    mockShowError,
    mockLoggerError,
    saveBackupCredentials,
    storeState,
} = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockRequirePin: vi.fn(),
    mockShowToast: vi.fn(),
    mockShowError: vi.fn(),
    mockLoggerError: vi.fn(),
    saveBackupCredentials: vi.fn(),
    storeState: {
        salt: null as string | null,
        backupId: null as string | null,
    },
}))

// The real exports must survive: the typed errors this flow surfaces live in
// this package, and `isExpectedError` checks them by identity.
vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
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
vi.mock('../../storage', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    saveBackupCredentials,
}))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}`

beforeEach(() => {
    vi.clearAllMocks()
    storeState.salt = SALT
    storeState.backupId = BACKUP_ID
    mockRequest.mockResolvedValue('device')
    mockRequirePin.mockResolvedValue(true)
    saveBackupCredentials.mockResolvedValue('saved')
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
        expect(saveBackupCredentials).not.toHaveBeenCalled()
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
        expect(saveBackupCredentials).toHaveBeenCalledWith('device')
    })

    test('saves nothing when PIN verification fails', async () => {
        mockRequirePin.mockResolvedValueOnce(false)

        await store()

        expect(saveBackupCredentials).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
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

    test.each(['device', 'icloud', 'googleDrive'] as const)(
        'saves to %s and confirms',
        async destination => {
            mockRequest.mockResolvedValueOnce(destination)

            await store()

            expect(saveBackupCredentials).toHaveBeenCalledWith(destination)
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
        saveBackupCredentials.mockResolvedValueOnce('cancelled')

        await store()

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockShowError).not.toHaveBeenCalled()
    })

    test('passes a destination error through so it can show its own copy', async () => {
        mockRequest.mockResolvedValueOnce('icloud')
        const error = new ICloudUnavailableError()
        saveBackupCredentials.mockRejectedValueOnce(error)

        await store()

        expect(mockShowError).toHaveBeenCalledWith(
            error,
            'cloud_backup.store_credentials.error',
        )
    })

    test('shows the generic error for any other failure', async () => {
        const error = new Error('disk full')
        saveBackupCredentials.mockRejectedValueOnce(error)

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
