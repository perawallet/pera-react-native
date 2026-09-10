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
import { useBackupCodeSheet } from '../useBackupCodeSheet'

const { decryptMock, resolveMock } = vi.hoisted(() => ({
    decryptMock: vi.fn(),
    resolveMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    decryptBackupSyncQr: decryptMock,
    BackupSyncQrError: class extends Error {},
}))
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: resolveMock, dismiss: vi.fn() }),
}))

const CONTENTS = { mnemonic: 'a b c', backupSalt: 'SALT', argon2id: {} }

describe('useBackupCodeSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        decryptMock.mockResolvedValue(CONTENTS)
    })

    test('resolves the decrypted contents when the code is right', async () => {
        const { result } = renderHook(() =>
            useBackupCodeSheet({ raw: 'ENVELOPE' }),
        )

        await act(() => result.current.handleCodeComplete('123456'))

        expect(decryptMock).toHaveBeenCalledWith('ENVELOPE', '123456')
        expect(resolveMock).toHaveBeenCalledWith(CONTENTS)
    })

    test('shows the error state and stays open when the code is wrong', async () => {
        decryptMock.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() =>
            useBackupCodeSheet({ raw: 'ENVELOPE' }),
        )

        await act(() => result.current.handleCodeComplete('000000'))

        expect(result.current.hasError).toBe(true)
        expect(resolveMock).not.toHaveBeenCalled()
    })

    test('clears the error once the shake finishes, so the user can retry', async () => {
        decryptMock.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() =>
            useBackupCodeSheet({ raw: 'ENVELOPE' }),
        )

        await act(() => result.current.handleCodeComplete('000000'))
        act(() => result.current.handleErrorAnimationComplete())

        expect(result.current.hasError).toBe(false)
    })

    test('disables the pad while deriving', async () => {
        let release: (value: unknown) => void = () => {}
        decryptMock.mockReturnValue(
            new Promise(resolve => {
                release = resolve
            }),
        )
        const { result } = renderHook(() =>
            useBackupCodeSheet({ raw: 'ENVELOPE' }),
        )

        act(() => {
            void result.current.handleCodeComplete('123456')
        })
        expect(result.current.isDeriving).toBe(true)

        await act(async () => {
            release(CONTENTS)
        })
        expect(result.current.isDeriving).toBe(false)
    })
})
