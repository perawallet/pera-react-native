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

import { useSecurityStore } from './store'

/**
 * Resolves once the lock screen is gone. `isAppLockActive` starts true and
 * stays so until the guard has settled, so this never resolves early.
 */
export const whenAppUnlocked = (): Promise<void> =>
    new Promise(resolve => {
        if (!useSecurityStore.getState().isAppLockActive) {
            resolve()
            return
        }
        const unsubscribe = useSecurityStore.subscribe(state => {
            if (state.isAppLockActive) return
            unsubscribe()
            resolve()
        })
    })
