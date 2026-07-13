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

type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>
type ChangeListener = (changes: StorageChanges, areaName: string) => void
type AlarmListener = (alarm: chrome.alarms.Alarm) => void

export type ChromeFake = {
    chrome: typeof chrome
    data: Map<string, unknown>
    sessionData: Map<string, unknown>
    alarms: Map<string, chrome.alarms.AlarmCreateInfo>
    emitExternalChange: (key: string, newValue: unknown) => void
    emitSessionChange: (key: string, newValue: unknown) => void
    fireAlarm: (name: string) => void
}

export const createChromeFake = (): ChromeFake => {
    const data = new Map<string, unknown>()
    const sessionData = new Map<string, unknown>()
    const alarms = new Map<string, chrome.alarms.AlarmCreateInfo>()
    const listeners = new Set<ChangeListener>()
    const alarmListeners = new Set<AlarmListener>()

    const emit = (changes: StorageChanges, areaName: string): void => {
        listeners.forEach(listener => listener(changes, areaName))
    }

    const local = {
        get: async (
            keys?: null | string | string[],
        ): Promise<Record<string, unknown>> => {
            if (keys == null) return Object.fromEntries(data)
            const wanted = typeof keys === 'string' ? [keys] : keys
            return Object.fromEntries(
                wanted
                    .filter(key => data.has(key))
                    .map(key => [key, data.get(key)]),
            )
        },
        set: async (items: Record<string, unknown>): Promise<void> => {
            const changes: StorageChanges = {}
            for (const [key, value] of Object.entries(items)) {
                changes[key] = { oldValue: data.get(key), newValue: value }
                data.set(key, value)
            }
            emit(changes, 'local')
        },
        remove: async (keys: string | string[]): Promise<void> => {
            const changes: StorageChanges = {}
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                changes[key] = { oldValue: data.get(key) }
                data.delete(key)
            }
            emit(changes, 'local')
        },
    }

    const session = {
        get: async (
            keys?: null | string | string[],
        ): Promise<Record<string, unknown>> => {
            if (keys == null) return Object.fromEntries(sessionData)
            const wanted = typeof keys === 'string' ? [keys] : keys
            return Object.fromEntries(
                wanted
                    .filter(key => sessionData.has(key))
                    .map(key => [key, sessionData.get(key)]),
            )
        },
        set: async (items: Record<string, unknown>): Promise<void> => {
            const changes: StorageChanges = {}
            for (const [key, value] of Object.entries(items)) {
                changes[key] = {
                    oldValue: sessionData.get(key),
                    newValue: value,
                }
                sessionData.set(key, value)
            }
            emit(changes, 'session')
        },
        remove: async (keys: string | string[]): Promise<void> => {
            const changes: StorageChanges = {}
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                changes[key] = { oldValue: sessionData.get(key) }
                sessionData.delete(key)
            }
            emit(changes, 'session')
        },
        setAccessLevel: async (): Promise<void> => {
            // No-op for testing
        },
    }

    const fake = {
        runtime: {
            id: 'test-extension-id',
            getManifest: () => ({
                manifest_version: 3,
                name: 'Pera Wallet',
                version: '0.1.0',
            }),
        },
        storage: {
            local,
            session,
            onChanged: {
                addListener: (listener: ChangeListener) =>
                    listeners.add(listener),
                removeListener: (listener: ChangeListener) =>
                    listeners.delete(listener),
            },
        },
        alarms: {
            create: async (
                name: string,
                info: chrome.alarms.AlarmCreateInfo,
            ) => {
                alarms.set(name, info)
            },
            clear: async (name: string): Promise<boolean> => {
                return alarms.delete(name)
            },
            onAlarm: {
                addListener: (listener: AlarmListener) =>
                    alarmListeners.add(listener),
                removeListener: (listener: AlarmListener) =>
                    alarmListeners.delete(listener),
            },
        },
    }

    return {
        chrome: fake as unknown as typeof chrome,
        data,
        sessionData,
        alarms,
        emitExternalChange: (key, newValue) => {
            const oldValue = data.get(key)
            data.set(key, newValue)
            emit({ [key]: { oldValue, newValue } }, 'local')
        },
        emitSessionChange: (key, newValue) => {
            const oldValue = sessionData.get(key)
            sessionData.set(key, newValue)
            emit({ [key]: { oldValue, newValue } }, 'session')
        },
        fireAlarm: (name: string) => {
            const info = alarms.get(name)
            if (!info) {
                throw new Error(
                    `fireAlarm('${name}') — no alarm with that name was created; ` +
                        'call chrome.alarms.create first',
                )
            }
            alarmListeners.forEach(listener =>
                listener({
                    name,
                    scheduledTime: Date.now(),
                    periodInMinutes: undefined,
                }),
            )
        },
    }
}
