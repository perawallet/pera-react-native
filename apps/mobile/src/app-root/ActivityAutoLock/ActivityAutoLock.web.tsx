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

import { useAutoLockActivity, useVaultLockState } from '@modules/vault'

// Sibling of VaultGate, not a child: activity on the unlock screen must NOT
// re-arm auto-lock, or an attacker at the lock screen gets a sliding window.
// useVaultLockState's isUnlocked gate makes useAutoLockActivity a no-op there.
export const ActivityAutoLock = (): null => {
    const { isUnlocked } = useVaultLockState()
    useAutoLockActivity(isUnlocked === true)
    return null
}
