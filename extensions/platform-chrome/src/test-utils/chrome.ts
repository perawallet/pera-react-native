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

export type ChromeFake = {
    chrome: typeof chrome
    data: Map<string, unknown>
    emitExternalChange: (key: string, newValue: unknown) => void
}

export const createChromeFake = (): ChromeFake => {
    const data = new Map<string, unknown>()
    const listeners = new Set<ChangeListener>()

    const emit = (changes: StorageChanges): void => {
        listeners.forEach(listener => listener(changes, 'local'))
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
            emit(changes)
        },
        remove: async (keys: string | string[]): Promise<void> => {
            const changes: StorageChanges = {}
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                changes[key] = { oldValue: data.get(key) }
                data.delete(key)
            }
            emit(changes)
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
            onChanged: {
                addListener: (listener: ChangeListener) =>
                    listeners.add(listener),
                removeListener: (listener: ChangeListener) =>
                    listeners.delete(listener),
            },
        },
    }

    return {
        chrome: fake as unknown as typeof chrome,
        data,
        emitExternalChange: (key, newValue) => {
            const oldValue = data.get(key)
            data.set(key, newValue)
            emit({ [key]: { oldValue, newValue } })
        },
    }
}
