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

import { useBackupCodeSetupSheet } from '../useBackupCodeSetupSheet'

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: resolveMock, dismiss: vi.fn() }),
}))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const SETUP_TITLE = 'cloud_backup.encryption_code.setup_title'
const CONFIRM_TITLE = 'cloud_backup.encryption_code.confirm_title'

describe('useBackupCodeSetupSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('asks for the code a second time before resolving', () => {
        const { result } = renderHook(() => useBackupCodeSetupSheet())

        act(() => result.current.handleCodeComplete('123456'))

        expect(result.current.title).toBe(CONFIRM_TITLE)
        expect(resolveMock).not.toHaveBeenCalled()
    })

    test('resolves the code once it is entered identically twice', () => {
        const { result } = renderHook(() => useBackupCodeSetupSheet())

        act(() => result.current.handleCodeComplete('123456'))
        act(() => result.current.handleCodeComplete('123456'))

        expect(resolveMock).toHaveBeenCalledWith('123456')
    })

    test('flags a mismatch instead of resolving', () => {
        const { result } = renderHook(() => useBackupCodeSetupSheet())

        act(() => result.current.handleCodeComplete('123456'))
        act(() => result.current.handleCodeComplete('654321'))

        expect(result.current.hasError).toBe(true)
        expect(resolveMock).not.toHaveBeenCalled()
    })

    test('sends the user back to choosing once the mismatch is shown', () => {
        const { result } = renderHook(() => useBackupCodeSetupSheet())

        act(() => result.current.handleCodeComplete('123456'))
        act(() => result.current.handleCodeComplete('654321'))
        act(() => result.current.handleErrorAnimationComplete())

        expect(result.current.title).toBe(SETUP_TITLE)
        expect(result.current.hasError).toBe(false)
    })

    test('does not match against the code discarded by a mismatch', () => {
        const { result } = renderHook(() => useBackupCodeSetupSheet())

        act(() => result.current.handleCodeComplete('123456'))
        act(() => result.current.handleCodeComplete('654321'))
        act(() => result.current.handleErrorAnimationComplete())
        // Entering the first attempt's code twice more is the only way through;
        // a stale `chosenCode` would resolve on this first entry instead.
        act(() => result.current.handleCodeComplete('123456'))

        expect(resolveMock).not.toHaveBeenCalled()
        expect(result.current.title).toBe(CONFIRM_TITLE)
    })
})
