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

import { useSecurityStore } from '../store'

type UseSecurityResult = {
    isPinEnabled: boolean
    isBiometricEnabled: boolean
    failedAttempts: number
    lockoutEndTime: number | null
    isLockedOut: boolean
}

export const useSecurity = (): UseSecurityResult => {
    const isPinEnabled = useSecurityStore(state => state.isPinEnabled)
    const isBiometricEnabled = useSecurityStore(
        state => state.isBiometricEnabled,
    )
    const failedAttempts = useSecurityStore(state => state.failedAttempts)
    const lockoutEndTime = useSecurityStore(state => state.lockoutEndTime)

    const isLockedOut = lockoutEndTime !== null && Date.now() < lockoutEndTime

    return {
        isPinEnabled,
        isBiometricEnabled,
        failedAttempts,
        lockoutEndTime,
        isLockedOut,
    }
}
