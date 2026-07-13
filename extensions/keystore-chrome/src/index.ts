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
    PBKDF2_ITERATIONS,
} from './vault/vault'
export { getSessionMasterKey, SESSION_MASTER_KEY } from './vault/session'
export {
    AUTO_LOCK_ALARM,
    DEFAULT_AUTO_LOCK_MINUTES,
    armAutoLock,
    disarmAutoLock,
    handleAutoLockAlarm,
} from './vault/autolock'
export {
    isPasskeyUnlockSupported,
    isPasskeyUnlockEnabled,
    enablePasskeyUnlock,
    unlockWithPasskey,
    disablePasskeyUnlock,
} from './vault/passkey'
