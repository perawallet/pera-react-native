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
import {
    PIN_LENGTH,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
    AUTO_LOCK_TIMEOUT_MS,
    PIN_STORAGE_KEY,
    BIOMETRIC_STORAGE_KEY,
} from '../constants'

describe('constants', () => {
    test('PIN_LENGTH is 6', () => {
        expect(PIN_LENGTH).toBe(6)
    })

    test('MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT is 5', () => {
        expect(MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT).toBe(5)
    })

    test('INITIAL_LOCKOUT_SECONDS is 30', () => {
        expect(INITIAL_LOCKOUT_SECONDS).toBe(30)
    })

    test('AUTO_LOCK_TIMEOUT_MS is 5 minutes', () => {
        expect(AUTO_LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000)
    })

    test('PIN_STORAGE_KEY is correct', () => {
        expect(PIN_STORAGE_KEY).toBe('pera.pinCode')
    })

    test('BIOMETRIC_STORAGE_KEY is correct', () => {
        expect(BIOMETRIC_STORAGE_KEY).toBe('pera.biometricPinCode')
    })
})
