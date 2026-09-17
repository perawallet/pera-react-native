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

import { describe, test, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConfirmTurnOffBackupSheet } from '../useConfirmTurnOffBackupSheet'

describe('useConfirmTurnOffBackupSheet', () => {
    test('leaves confirming enabled when no acknowledgement is required', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(result.current.isConfirmDisabled).toBe(false)
    })

    test('keeps confirming disabled until the acknowledgement is ticked', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(true))

        expect(result.current.isAcknowledged).toBe(false)
        expect(result.current.isConfirmDisabled).toBe(true)

        act(() => result.current.toggleAcknowledged())

        expect(result.current.isAcknowledged).toBe(true)
        expect(result.current.isConfirmDisabled).toBe(false)
    })

    test('disables confirming again when the acknowledgement is unticked', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(true))

        act(() => result.current.toggleAcknowledged())
        act(() => result.current.toggleAcknowledged())

        expect(result.current.isConfirmDisabled).toBe(true)
    })
})
