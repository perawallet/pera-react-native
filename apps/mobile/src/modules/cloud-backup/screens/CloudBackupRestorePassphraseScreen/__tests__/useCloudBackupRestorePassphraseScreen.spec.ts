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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const navigate = vi.fn()
const setMnemonic = vi.fn()
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate }),
}))
vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    useCloudBackupRestoreDraftStore: (sel: (s: unknown) => unknown) =>
        sel({ setMnemonic }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const errorToast = vi.fn()
vi.mock('@hooks/useToast', () => ({ useToast: () => ({ errorToast }) }))

// `useMnemonicWordEntry` re-reads the clipboard on a paste-sized delta; an
// empty read makes it fall through to the typed value.
vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ readText: async () => '' }),
}))

import { useCloudBackupRestorePassphraseScreen } from '../useCloudBackupRestorePassphraseScreen'

describe('useCloudBackupRestorePassphraseScreen', () => {
    beforeEach(() => {
        navigate.mockReset()
        setMnemonic.mockReset()
        errorToast.mockReset()
    })

    it('is not submittable until all words are filled', () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        expect(result.current.canContinue).toBe(false)
    })

    it('saves the mnemonic and navigates to the encryption-key screen', async () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        await act(async () => {
            for (let i = 0; i < result.current.words.length; i += 1) {
                await result.current.handleWordChange(`w${i}`, i)
            }
        })
        expect(result.current.canContinue).toBe(true)
        act(() => result.current.handleContinue())
        expect(setMnemonic).toHaveBeenCalled()
        expect(navigate).toHaveBeenCalledWith('CloudBackupRestoreEncryptionKey')
    })

    it('distributes a pasted 12-word phrase across every slot', async () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        const phrase = Array.from({ length: 12 }, (_, i) => `word${i}`)
        await act(async () => {
            await result.current.handleWordChange(phrase.join(' '), 0)
        })
        expect(result.current.words).toEqual(phrase)
        expect(result.current.canContinue).toBe(true)
    })

    it('warns instead of filling when the pasted phrase is too long', async () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        await act(async () => {
            await result.current.handleWordChange(
                Array.from({ length: 25 }, (_, i) => `word${i}`).join(' '),
                0,
            )
        })
        expect(errorToast).toHaveBeenCalledWith(
            'cloud_backup.restore.too_many_words_title',
            'cloud_backup.restore.too_many_words_body',
        )
        expect(result.current.words.every(word => word === '')).toBe(true)
    })

    it('offers wordlist completions for the focused slot', async () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        await act(async () => {
            await result.current.handleWordChange('aba', 0)
        })
        expect(result.current.suggestions).toContain('abandon')
    })

    it('advances the focused slot on submit', () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        expect(result.current.focused).toBe(0)
        act(() => result.current.handleSubmitEditing(0))
        expect(result.current.focused).toBe(1)
    })

    it('fills the focused slot from a suggestion and moves on', () => {
        const { result } = renderHook(() =>
            useCloudBackupRestorePassphraseScreen(),
        )
        act(() => result.current.handleSelectSuggestion('abandon'))
        expect(result.current.words[0]).toBe('abandon')
        expect(result.current.focused).toBe(1)
    })
})
