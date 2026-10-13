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

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
    MIN_PASSWORD_SCORE,
    usePasswordStrength,
} from '../usePasswordStrength.web'

describe('usePasswordStrength', () => {
    it.each(['', 'short'])('flags %j as too_short', password => {
        const { result } = renderHook(() => usePasswordStrength(password))
        expect(result.current.error).toBe('too_short')
    })

    it.each(['password1', 'qwerty12345', 'perawallet2026'])(
        'flags the guessable %j as too_weak',
        password => {
            const { result } = renderHook(() => usePasswordStrength(password))
            expect(result.current.error).toBe('too_weak')
            expect(result.current.score).toBeLessThan(MIN_PASSWORD_SCORE)
        },
    )

    it('accepts a long uncommon passphrase', () => {
        const { result } = renderHook(() =>
            usePasswordStrength('kettle-orbit-9-sandal'),
        )
        expect(result.current.error).toBeNull()
        expect(result.current.score).toBeGreaterThanOrEqual(MIN_PASSWORD_SCORE)
    })
})
