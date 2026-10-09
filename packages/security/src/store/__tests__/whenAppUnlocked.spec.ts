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

import { describe, expect, it } from 'vitest'
import { useSecurityStore } from '../store'
import { whenAppUnlocked } from '../whenAppUnlocked'

const settled = async (promise: Promise<void>): Promise<boolean> => {
    let isSettled = false
    void promise.then(() => {
        isSettled = true
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    return isSettled
}

describe('whenAppUnlocked', () => {
    it('resolves at once when the app is not locked', async () => {
        useSecurityStore.getState().setAppLockActive(false)

        expect(await settled(whenAppUnlocked())).toBe(true)
    })

    it('waits for the lock screen to go away', async () => {
        useSecurityStore.getState().setAppLockActive(true)
        const unlocked = whenAppUnlocked()

        expect(await settled(unlocked)).toBe(false)

        useSecurityStore.getState().setAppLockActive(false)

        expect(await settled(unlocked)).toBe(true)
    })
})
