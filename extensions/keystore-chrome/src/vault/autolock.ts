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

import { AUTO_LOCK_MINUTES_KEY } from '../storage-keys'
import { clearSessionMasterKey } from './session'

export { AUTO_LOCK_MINUTES_KEY }

export const AUTO_LOCK_ALARM = 'pera-vault-auto-lock'
export const DEFAULT_AUTO_LOCK_MINUTES = 15

export const AUTO_LOCK_MINUTES_OPTIONS = [5, 15, 30, 60] as const

export const getAutoLockMinutes = async (): Promise<number> => {
    const stored = await chrome.storage.local.get(AUTO_LOCK_MINUTES_KEY)
    const value = stored[AUTO_LOCK_MINUTES_KEY]
    return typeof value === 'number' &&
        (AUTO_LOCK_MINUTES_OPTIONS as readonly number[]).includes(value)
        ? value
        : DEFAULT_AUTO_LOCK_MINUTES
}

export const setAutoLockMinutes = async (minutes: number): Promise<void> => {
    if (!(AUTO_LOCK_MINUTES_OPTIONS as readonly number[]).includes(minutes)) {
        throw new Error(
            `Invalid auto-lock minutes: ${minutes}. Allowed: ${AUTO_LOCK_MINUTES_OPTIONS.join(', ')}`,
        )
    }
    await chrome.storage.local.set({ [AUTO_LOCK_MINUTES_KEY]: minutes })
}

/**
 * (Re)schedules the auto-lock alarm. Called on vault create/unlock and on
 * every surface open while unlocked — a sliding inactivity window. The alarm
 * outlives UI contexts; the background service worker handles it firing.
 * With no argument, reads the persisted user preference.
 */
export const armAutoLock = async (minutes?: number): Promise<void> => {
    const delayInMinutes = minutes ?? (await getAutoLockMinutes())
    await chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes })
}

export const disarmAutoLock = async (): Promise<void> => {
    await chrome.alarms.clear(AUTO_LOCK_ALARM)
}

export const handleAutoLockAlarm = async (
    alarm: chrome.alarms.Alarm,
): Promise<void> => {
    if (alarm.name !== AUTO_LOCK_ALARM) return
    await clearSessionMasterKey()
    await disarmAutoLock()
}
