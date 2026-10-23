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

import { renderHook } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { useCardStore } from '@perawallet/wallet-core-card'
import { useClearPasswordOnExit } from '../useClearPasswordOnExit'

describe('useClearPasswordOnExit', () => {
    it('keeps the password and its login budget while mounted and drops both on unmount', () => {
        useCardStore.getState().setPassword('Correct-Horse-1234')
        useCardStore
            .getState()
            .recordLoginAttempt({ isAutomatic: true, at: 1000 })
        const { unmount } = renderHook(() => useClearPasswordOnExit())

        expect(useCardStore.getState().password).toBe('Correct-Horse-1234')

        unmount()
        expect(useCardStore.getState().password).toBeNull()
        expect(useCardStore.getState().loginAttempts.lastAt).toBeNull()
    })
})
