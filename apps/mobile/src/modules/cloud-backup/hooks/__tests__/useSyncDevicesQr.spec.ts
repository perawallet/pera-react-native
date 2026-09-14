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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncDevicesQr } from '../useSyncDevicesQr'

const {
    requirePinMock,
    requestSheetMock,
    withMnemonicMock,
    encryptMock,
    showErrorMock,
    backupStore,
} = vi.hoisted(() => ({
    requirePinMock: vi.fn(),
    requestSheetMock: vi.fn(),
    withMnemonicMock: vi.fn(),
    encryptMock: vi.fn(),
    showErrorMock: vi.fn(),
    backupStore: { salt: 'BACKUP_SALT' } as { salt: string | null },
}))

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinMock,
    }),
    PinEditContent: () => null,
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestSheetMock }),
}))
vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupStore: (selector: (s: unknown) => unknown) =>
        selector(backupStore),
    withBackupMnemonicIndices: withMnemonicMock,
    encryptBackupSyncQr: encryptMock,
    BackupMnemonicParseError: class extends Error {},
}))
vi.mock('@perawallet/wallet-core-kms', () => ({
    mnemonicIndexToWord: (i: number) => `w${i}`,
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: showErrorMock }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))
vi.mock('../../components/SyncDevicesQrSheet', () => ({
    SyncDevicesQrSheet: () => null,
}))

// Drives the code sheet the way the real PinEditContent does: invoke the
// onPinConfirmed with a confirmed code, then resolve true.
const resolveCodeSheetWith = (code: string) =>
    requestSheetMock.mockImplementation(
        async ({
            contents,
        }: {
            contents: { props: Record<string, unknown> }
        }) => {
            const handler = contents.props.onPinConfirmed as
                | ((pin: string) => Promise<unknown>)
                | undefined
            if (!handler) return undefined
            await handler(code)
            return true
        },
    )

describe('useSyncDevicesQr', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        backupStore.salt = 'BACKUP_SALT'
        requirePinMock.mockResolvedValue(true)
        encryptMock.mockResolvedValue('ENVELOPE')
        withMnemonicMock.mockImplementation(
            async (handler: (i: Uint16Array) => unknown) =>
                handler(new Uint16Array([1, 2, 3])),
        )
    })

    test('opens no sheet when the app PIN gate is declined', async () => {
        requirePinMock.mockResolvedValue(false)
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(requestSheetMock).not.toHaveBeenCalled()
    })

    test('opens no QR sheet when the code sheet is cancelled', async () => {
        requestSheetMock.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(requestSheetMock).toHaveBeenCalledTimes(1)
        expect(encryptMock).not.toHaveBeenCalled()
    })

    test('seals the phrase under the entered code and shows the QR', async () => {
        resolveCodeSheetWith('123456')
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(encryptMock).toHaveBeenCalledWith({
            mnemonic: 'w1 w2 w3',
            backupSalt: 'BACKUP_SALT',
            code: '123456',
        })
        expect(requestSheetMock).toHaveBeenCalledTimes(2)
    })

    test('seals inside the accessor handler, before the indices are released', async () => {
        resolveCodeSheetWith('123456')
        const order: string[] = []
        // Mirrors the real accessor: the index buffer is zeroed the moment the
        // handler returns, so a seal running after this resolves can only ever
        // see zeroed words.
        withMnemonicMock.mockImplementation(
            async (handler: (i: Uint16Array) => unknown) => {
                const indices = new Uint16Array([1, 2, 3])
                try {
                    return await handler(indices)
                } finally {
                    indices.fill(0)
                    order.push('indices-released')
                }
            },
        )
        encryptMock.mockImplementation(
            async ({ mnemonic }: { mnemonic: string }) => {
                order.push(`sealed:${mnemonic}`)
                return 'ENVELOPE'
            },
        )
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(order).toEqual(['sealed:w1 w2 w3', 'indices-released'])
    })

    test('surfaces an error and shows no QR when no phrase is stored', async () => {
        resolveCodeSheetWith('123456')
        withMnemonicMock.mockResolvedValue(null)
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(showErrorMock).toHaveBeenCalled()
        expect(requestSheetMock).toHaveBeenCalledTimes(1)
    })

    test('surfaces an error when the stored phrase is unreadable', async () => {
        resolveCodeSheetWith('123456')
        withMnemonicMock.mockRejectedValue(new Error('unreadable'))
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(showErrorMock).toHaveBeenCalled()
        expect(requestSheetMock).toHaveBeenCalledTimes(1)
    })

    test('surfaces an error without prompting when no backup salt is stored', async () => {
        backupStore.salt = null
        const { result } = renderHook(() => useSyncDevicesQr())

        await act(() => result.current.showSyncQr())

        expect(showErrorMock).toHaveBeenCalled()
        expect(requestSheetMock).not.toHaveBeenCalled()
    })
})
