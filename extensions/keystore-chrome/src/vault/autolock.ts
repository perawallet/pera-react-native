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

import { clearSessionMasterKey } from './session'

export const AUTO_LOCK_ALARM = 'pera-vault-auto-lock'
export const DEFAULT_AUTO_LOCK_MINUTES = 15

/**
 * (Re)schedules the auto-lock alarm. Called on vault create/unlock and on
 * every surface open while unlocked — a sliding inactivity window. The alarm
 * outlives UI contexts; the background service worker handles it firing.
 */
export const armAutoLock = async (
    minutes: number = DEFAULT_AUTO_LOCK_MINUTES,
): Promise<void> => {
    await chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: minutes })
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
