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

// This package's source uses the ambient `chrome` global directly (no local
// imports) — its own tsconfig lists "chrome" in `types`, but downstream
// consumers whose tsconfig does NOT (e.g. apps/mobile) still pull this
// source into their tsc program via path-aliased imports. A `types`
// list is program-wide, but an explicit triple-slash reference is honored
// regardless of the consuming project's `types` list, so this keeps the
// package self-contained without forcing "chrome" back onto every consumer.
/// <reference types="chrome" />

export * from './errors'
export * from './extension'
export * from './storage'
export * from './store'
export * from './types'
export { context } from './constants'
export {
    createVault,
    changePassword,
    isUnlocked,
    isVaultInitialized,
    lockVault,
    onLockStateChanged,
    unlockVault,
    verifyVaultPassword,
    PBKDF2_ITERATIONS,
    PBKDF2_MAX_ITERATIONS,
} from './vault/vault'
export { getLockoutRemainingSeconds } from './vault/lockout'
export { getSessionMasterKey, SESSION_MASTER_KEY } from './vault/session'
export {
    AUTO_LOCK_ALARM,
    AUTO_LOCK_MINUTES_KEY,
    AUTO_LOCK_MINUTES_OPTIONS,
    DEFAULT_AUTO_LOCK_MINUTES,
    armAutoLock,
    disarmAutoLock,
    getAutoLockMinutes,
    handleAutoLockAlarm,
    setAutoLockMinutes,
} from './vault/autolock'
export {
    isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled,
    enablePasskeyUnlock,
    unlockWithPasskey,
    verifyPasskey,
    disablePasskeyUnlock,
} from './vault/passkey'
export { createKeystoreSigner } from './webauthn/keystore-signer'
