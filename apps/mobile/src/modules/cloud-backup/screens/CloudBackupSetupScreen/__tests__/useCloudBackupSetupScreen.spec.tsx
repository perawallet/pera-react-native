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
import { renderHook } from '@testing-library/react'
import { useNavigation } from '@react-navigation/native'
import { useClipboard } from '@hooks/useClipboard'
import {
    generateCloudBackupCredentials,
    useCloudBackupDraftStore,
} from '@perawallet/wallet-core-backup'
import { mnemonicIndexToWord } from '@perawallet/wallet-core-kms'
import { useCloudBackupSetupScreen } from '../useCloudBackupSetupScreen'

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    generateCloudBackupCredentials: vi.fn(),
    useCloudBackupDraftStore: vi.fn(),
}))

// Two positions deliberately share an index: a repeated word must still render
// and copy at both of its positions.
const INDICES = [412, 1337, 88, 7, 2045, 601, 19, 943, 7, 1500, 260, 1111]
const SALT = 'q311Z4ReDNWpMVuH8XdvSw=='

const mockCopyToClipboard = vi.fn()
const mockNavigate = vi.fn()
const mockSetDraft = vi.fn()
const mockClearDraft = vi.fn()

let indices: Uint16Array

beforeEach(() => {
    vi.clearAllMocks()
    indices = Uint16Array.from(INDICES)
    ;(useClipboard as ReturnType<typeof vi.fn>).mockReturnValue({
        copyToClipboard: mockCopyToClipboard,
        readText: vi.fn(),
    })
    ;(useNavigation as ReturnType<typeof vi.fn>).mockReturnValue({
        navigate: mockNavigate,
    })
    ;(
        useCloudBackupDraftStore as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation((selector: (state: unknown) => unknown) =>
        selector({ setDraft: mockSetDraft, clearDraft: mockClearDraft }),
    )
    ;(
        generateCloudBackupCredentials as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({
        mnemonicIndices: indices,
        salt: SALT,
    }))
})

describe('useCloudBackupSetupScreen', () => {
    test('exposes the generated wordlist indices and salt', () => {
        const { result } = renderHook(() => useCloudBackupSetupScreen())

        expect(Array.from(result.current.mnemonicIndices)).toEqual(
            Array.from(indices),
        )
        expect(result.current.saltB64).toBe(SALT)
    })

    test('generates credentials only once across re-renders', () => {
        const { rerender } = renderHook(() => useCloudBackupSetupScreen())

        rerender()

        expect(generateCloudBackupCredentials).toHaveBeenCalledTimes(1)
    })

    test('copies the passphrase as a space-joined string', () => {
        const { result } = renderHook(() => useCloudBackupSetupScreen())

        result.current.handleCopyPassphrase()

        expect(mockCopyToClipboard).toHaveBeenCalledWith(
            INDICES.map(index => mnemonicIndexToWord(index)).join(' '),
        )
    })

    test('copies the encryption key (salt)', () => {
        const { result } = renderHook(() => useCloudBackupSetupScreen())

        result.current.handleCopyEncryptionKey()

        expect(mockCopyToClipboard).toHaveBeenCalledWith(SALT)
    })

    test('on proceed, stores the draft and navigates to verify', () => {
        const { result } = renderHook(() => useCloudBackupSetupScreen())

        result.current.handleProceed()

        expect(mockSetDraft).toHaveBeenCalledWith({
            mnemonicIndices: indices,
            salt: SALT,
        })
        expect(mockNavigate).toHaveBeenCalledWith('CloudBackupVerify')
    })

    test('clears the draft when the screen unmounts', () => {
        const { unmount } = renderHook(() => useCloudBackupSetupScreen())

        expect(mockClearDraft).not.toHaveBeenCalled()
        unmount()
        expect(mockClearDraft).toHaveBeenCalledTimes(1)
    })

    test('zeroes its own index buffer on unmount', () => {
        const { unmount } = renderHook(() => useCloudBackupSetupScreen())

        unmount()

        expect(Array.from(indices)).toEqual(Array(INDICES.length).fill(0))
    })
})
