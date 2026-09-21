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
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { useStoreBackupCredentials } from '../useStoreBackupCredentials'

const {
    mockRequest,
    mockRequirePin,
    mockShowToast,
    mockShowError,
    mockLoggerError,
    saveCredentialsFile,
    storeState,
} = vi.hoisted(() => ({
    mockRequest: vi.fn(),
    mockRequirePin: vi.fn(),
    mockShowToast: vi.fn(),
    mockShowError: vi.fn(),
    mockLoggerError: vi.fn(),
    saveCredentialsFile: vi.fn(),
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
    saveCredentialsFile,
}))

const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const BACKUP_ID = `did:pera:VQBGR${'A'.repeat(53)}`

beforeEach(() => {
    vi.clearAllMocks()
    storeState.salt = SALT
    storeState.backupId = BACKUP_ID
    mockRequest.mockResolvedValue('device')
    mockRequirePin.mockResolvedValue(true)
    saveCredentialsFile.mockResolvedValue('saved')
})

const renderStoreHook = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return renderHook(() => useStoreBackupCredentials(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
}

const store = async (options?: { hasVerifiedPin?: boolean }) => {
    const { result } = renderStoreHook()
    await result.current.storeCredentials(options)
}

describe('useStoreBackupCredentials', () => {
    // Half a backup stops just as early as none: the sheet, the PIN and a cloud
    // sign-in all come before the save that would otherwise find the gap.
    test.each([
        ['no backup is stored', { salt: null, backupId: null }],
        ['the backup has no salt', { salt: null }],
        ['the backup has no id', { backupId: null }],
    ])('shows an error and opens nothing when %s', async (_, gone) => {
        Object.assign(storeState, gone)

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
        expect(saveCredentialsFile).not.toHaveBeenCalled()
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
        expect(saveCredentialsFile).toHaveBeenCalledWith('device', {
            salt: SALT,
            backupId: BACKUP_ID,
        })
    })

    test('saves nothing when PIN verification fails', async () => {
        mockRequirePin.mockResolvedValueOnce(false)

        await store()

        expect(saveCredentialsFile).not.toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalled()
    })

    test('saves nothing when the backup is deleted while the sheet is open', async () => {
        mockRequest.mockImplementationOnce(async () => {
            storeState.salt = null

            return 'device'
        })

        await store()

        // The refusal itself lives in `useSaveCredentialsFile`, which this spec
        // runs for real: nothing reaches the file writer.
        expect(saveCredentialsFile).not.toHaveBeenCalled()
        expect(mockShowError).toHaveBeenCalledWith(
            expect.any(Error),
            'cloud_backup.store_credentials.error',
        )
        expect(JSON.stringify(mockLoggerError.mock.calls)).not.toContain(SALT)
    })

    test('ignores a second call while one is in flight', async () => {
        let resolveSheet: (value: string | undefined) => void = () => {}
        mockRequest.mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    resolveSheet = resolve
                }),
        )
        const { result } = renderStoreHook()

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

            expect(saveCredentialsFile).toHaveBeenCalledWith(destination, {
                salt: SALT,
                backupId: BACKUP_ID,
            })
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
        saveCredentialsFile.mockResolvedValueOnce('cancelled')

        await store()

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(mockShowError).not.toHaveBeenCalled()
    })
})
