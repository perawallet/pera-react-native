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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    BackupMnemonicParseError,
    withBackupMnemonicIndices,
} from '@perawallet/wallet-core-backup'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBackupCredentialsSheet } from '../useBackupCredentialsSheet'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

const BACKUP_ID = 'did:pera:CREDENTIALADDRESS'
const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='
const INDICES = [412, 1337, 88]

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: vi.fn(
        (
            selector: (s: {
                backupId: string | null
                salt: string | null
            }) => unknown,
        ) => selector({ backupId: BACKUP_ID, salt: SALT }),
    ),
    backupIdToAddress: (v: string) => v.replace('did:pera:', ''),
    withBackupMnemonicIndices: vi.fn(),
    BackupMnemonicParseError: class BackupMnemonicParseError extends Error {},
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { error: vi.fn() },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(),
}))

const mockResolve = vi.fn()

// Stands in for the real accessor: hands the handler a buffer it owns, then
// zeroes it once the handler returns — the contract the hook has to copy out of.
let accessorBuffer: Uint16Array

beforeEach(() => {
    vi.clearAllMocks()
    ;(useBottomSheetResult as Mock).mockReturnValue({
        resolve: mockResolve,
        dismiss: vi.fn(),
    })
    ;(withBackupMnemonicIndices as Mock).mockImplementation(
        async (handler: (indices: Uint16Array) => unknown) => {
            accessorBuffer = Uint16Array.from(INDICES)
            try {
                return await handler(accessorBuffer)
            } finally {
                accessorBuffer.fill(0)
            }
        },
    )
})

describe('useBackupCredentialsSheet', () => {
    test('exposes the credential address derived from the backup id and the salt as encryption key', async () => {
        const { result } = renderHook(() => useBackupCredentialsSheet())

        expect(result.current.credentialAddress).toBe('CREDENTIALADDRESS')
        expect(result.current.encryptionKey).toBe(SALT)
        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('ready'),
        )
    })

    test('copies the phrase out of the accessor buffer before it is zeroed', async () => {
        const { result } = renderHook(() => useBackupCredentialsSheet())

        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('ready'),
        )

        expect(Array.from(result.current.wordIndices)).toEqual(INDICES)
        // The accessor wiped its own buffer; the hook must not be aliasing it.
        expect(Array.from(accessorBuffer)).toEqual([0, 0, 0])
    })

    test('reports unavailable when nothing is stored for this device', async () => {
        ;(withBackupMnemonicIndices as Mock).mockResolvedValue(null)

        const { result } = renderHook(() => useBackupCredentialsSheet())

        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('unavailable'),
        )
        expect(result.current.wordIndices).toHaveLength(0)
    })

    test('reports unreadable when the stored phrase cannot be decoded', async () => {
        ;(withBackupMnemonicIndices as Mock).mockRejectedValue(
            new BackupMnemonicParseError('corrupt'),
        )

        const { result } = renderHook(() => useBackupCredentialsSheet())

        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('unreadable'),
        )
        expect(result.current.wordIndices).toHaveLength(0)
    })

    test('zeroes the retained buffer when the sheet unmounts', async () => {
        const { result, unmount } = renderHook(() =>
            useBackupCredentialsSheet(),
        )
        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('ready'),
        )
        const retained = result.current.wordIndices

        unmount()

        expect(Array.from(retained)).toEqual([0, 0, 0])
    })

    test('handleStore tracks the store tap and resolves the sheet with store', async () => {
        const { result } = renderHook(() => useBackupCredentialsSheet())

        result.current.handleStore()

        expect(trackEvent).toHaveBeenCalledWith(
            CloudBackupEvent.CredentialsStore,
        )
        expect(mockResolve).toHaveBeenCalledWith('store')
        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('ready'),
        )
    })
})
