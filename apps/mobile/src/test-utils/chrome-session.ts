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

type ChangeListener = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: string,
) => void

export type SessionChromeFake = {
    chrome: typeof chrome
    local: Map<string, unknown>
    session: Map<string, unknown>
}

// `test-utils/chrome` in @perawallet/wallet-extension-platform-chrome is not
// reachable here (that package exports only `.` and `./bootstrap`), and this
// hook needs a working storage.onChanged — the browser-side fake elsewhere
// doesn't wire one up.
export const createSessionChromeFake = (): SessionChromeFake => {
    const local = new Map<string, unknown>()
    const session = new Map<string, unknown>()
    const listeners = new Set<ChangeListener>()

    const area = (store: Map<string, unknown>, areaName: string) => ({
        get: async (keys?: null | string | string[]) => {
            if (keys == null) return Object.fromEntries(store)
            const wanted = typeof keys === 'string' ? [keys] : keys
            return Object.fromEntries(
                wanted
                    .filter(key => store.has(key))
                    .map(key => [key, store.get(key)]),
            )
        },
        set: async (items: Record<string, unknown>) => {
            const changes: Record<
                string,
                { oldValue?: unknown; newValue?: unknown }
            > = {}
            for (const [key, value] of Object.entries(items)) {
                changes[key] = { oldValue: store.get(key), newValue: value }
                store.set(key, value)
            }
            listeners.forEach(listener => listener(changes, areaName))
        },
        remove: async (keys: string | string[]) => {
            const changes: Record<string, { oldValue?: unknown }> = {}
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                changes[key] = { oldValue: store.get(key) }
                store.delete(key)
            }
            listeners.forEach(listener => listener(changes, areaName))
        },
        setAccessLevel: async () => {},
    })

    const fake = {
        storage: {
            local: area(local, 'local'),
            session: area(session, 'session'),
            onChanged: {
                addListener: (listener: ChangeListener) => {
                    listeners.add(listener)
                },
                removeListener: (listener: ChangeListener) => {
                    listeners.delete(listener)
                },
            },
        },
    }

    return { chrome: fake as unknown as typeof chrome, local, session }
}
