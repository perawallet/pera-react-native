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

export const PIN_LENGTH = 6
export const MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT = 5
export const INITIAL_LOCKOUT_SECONDS = 30
export const PIN_STORAGE_KEY = 'pera.pinCode'
export const BIOMETRIC_STORAGE_KEY = 'pera.biometricPinCode'

export type SecurityState = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    failedAttempts: number
    lockoutEndTime: number | null
    lastBackgroundTime: number | null

    setIsPinEnabled: (enabled: boolean) => void
    setIsBiometricEnabled: (enabled: boolean) => void
    incrementFailedAttempts: () => void
    resetFailedAttempts: () => void
    setLockoutEndTime: (time: number | null) => void
    setLastBackgroundTime: (time: number | null) => void
    reset: () => void
}

export type PinEntryMode =
    | 'setup'
    | 'confirm'
    | 'verify'
    | 'change_old'
    | 'change_new'
    | 'change_confirm'

export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none'
