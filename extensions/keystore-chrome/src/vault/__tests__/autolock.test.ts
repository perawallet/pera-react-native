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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { createVault, isUnlocked, unlockVault, lockVault } from '../vault'
import {
    AUTO_LOCK_ALARM,
    armAutoLock,
    disarmAutoLock,
    handleAutoLockAlarm,
} from '../autolock'

describe('auto-lock', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('armAutoLock schedules the named alarm with the given delay', async () => {
        await armAutoLock(5)
        expect(fake.alarms.get(AUTO_LOCK_ALARM)).toEqual({ delayInMinutes: 5 })
    })

    it('createVault and unlockVault arm the default 15-minute alarm', async () => {
        await createVault('pw')
        expect(fake.alarms.get(AUTO_LOCK_ALARM)).toEqual({
            delayInMinutes: 15,
        })
        fake.alarms.clear()
        await lockVault()
        await unlockVault('pw')
        expect(fake.alarms.get(AUTO_LOCK_ALARM)).toEqual({
            delayInMinutes: 15,
        })
    })

    it('handleAutoLockAlarm locks the vault for the vault alarm only', async () => {
        await createVault('pw')
        await handleAutoLockAlarm({
            name: 'some-other-alarm',
            scheduledTime: Date.now(),
        } as chrome.alarms.Alarm)
        expect(await isUnlocked()).toBe(true)
        await handleAutoLockAlarm({
            name: AUTO_LOCK_ALARM,
            scheduledTime: Date.now(),
        } as chrome.alarms.Alarm)
        expect(await isUnlocked()).toBe(false)
    })

    it('disarmAutoLock clears the alarm', async () => {
        await armAutoLock()
        await disarmAutoLock()
        expect(fake.alarms.has(AUTO_LOCK_ALARM)).toBe(false)
    })

    it('locks the vault when the alarm fires through the onAlarm listener', async () => {
        await createVault('correct horse')
        fake.chrome.alarms.onAlarm.addListener(alarm => {
            void handleAutoLockAlarm(alarm)
        })
        fake.fireAlarm(AUTO_LOCK_ALARM)
        await vi.waitFor(async () => {
            expect(await isUnlocked()).toBe(false)
        })
    })

    it('handleAutoLockAlarm locks the vault and clears the alarm', async () => {
        await createVault('correct horse')
        await handleAutoLockAlarm({
            name: AUTO_LOCK_ALARM,
            scheduledTime: Date.now(),
        } as chrome.alarms.Alarm)
        expect(await isUnlocked()).toBe(false)
        expect(fake.alarms.has(AUTO_LOCK_ALARM)).toBe(false)
    })

    it('lockVault disarms the auto-lock alarm', async () => {
        await createVault('correct horse')
        expect(fake.alarms.has(AUTO_LOCK_ALARM)).toBe(true)
        await lockVault()
        expect(fake.alarms.has(AUTO_LOCK_ALARM)).toBe(false)
    })
})
