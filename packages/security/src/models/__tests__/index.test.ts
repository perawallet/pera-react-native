/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import type { SecurityState, PinEntryMode, BiometricType } from '../index'

describe('models/types', () => {
    test('SecurityState type has correct properties', () => {
        const mockState: SecurityState = {
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: null,
            incrementFailedAttempts: () => {},
            resetFailedAttempts: () => {},
            setLockoutEndTime: () => {},
            setAutoLockStartedAt: () => {},
            reset: () => {},
        }

        expect(mockState.failedAttempts).toBe(0)
        expect(mockState.lockoutEndTime).toBeNull()
        expect(mockState.autoLockStartedAt).toBeNull()
    })

    test('PinEntryMode type has correct values', () => {
        const modes: PinEntryMode[] = [
            'setup',
            'confirm',
            'verify',
            'change_old',
            'change_new',
            'change_confirm',
        ]

        expect(modes).toHaveLength(6)
        expect(modes).toContain('setup')
        expect(modes).toContain('verify')
    })

    test('BiometricType type has correct values', () => {
        const types: BiometricType[] = ['face', 'fingerprint', 'iris', 'none']

        expect(types).toHaveLength(4)
        expect(types).toContain('face')
        expect(types).toContain('fingerprint')
        expect(types).toContain('iris')
        expect(types).toContain('none')
    })
})
