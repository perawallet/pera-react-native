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

type MessageListener = (
    message: unknown,
    sender: unknown,
    sendResponse: (response?: unknown) => void,
) => boolean | undefined

type FakeTab = { id: number; url: string; windowId: number }

export type ChromeFake = {
    chrome: typeof chrome
    data: Map<string, unknown>
    emitExternalChange: (
        key: string,
        newValue: unknown,
        areaName?: string,
    ) => void
    messageListeners: Set<MessageListener>
    createdTabs: Array<{ url: string }>
    // Open-tab state for chrome.tabs.query/update fixtures. Tests seed a
    // pre-existing "expanded" tab by pushing onto this array directly.
    openTabs: FakeTab[]
    tabUpdates: Array<{
        id: number
        changes: { url?: string; active?: boolean }
    }>
    windowUpdates: Array<{ windowId: number; changes: { focused?: boolean } }>
    // Models "this extension page is running in tab X" for
    // chrome.tabs.getCurrent(); tests call this to seed (or clear, via
    // undefined) the tab getCurrent resolves to.
    setCurrentTab: (tab: FakeTab | undefined) => void
    // ids removed via chrome.tabs.remove.
    removedTabIds: number[]
    sessionData: Map<string, unknown>
    // Every accessLevel the code under test asked for, in order. Real
    // setAccessLevel is idempotent and throws on some older Chromium builds —
    // tests assert the call happened exactly once.
    accessLevels: string[]
    alarms: Map<string, { periodInMinutes?: number; delayInMinutes?: number }>
    fireAlarm: (name: string) => Promise<void>
}

const TEST_EXTENSION_ID = 'test-extension-id'

// Default sender models the one real caller every existing fixture already
// exercises: the offscreen document calling through the storage proxy / db
// host. Tests that need to simulate a different caller (another extension
// page, or a content-script-shaped sender) pass a sender override to
// `sendMessage`.
const DEFAULT_SENDER = {
    id: TEST_EXTENSION_ID,
    url: `chrome-extension://${TEST_EXTENSION_ID}/offscreen.html`,
}

export const createChromeFake = (): ChromeFake => {
    const data = new Map<string, unknown>()
    const listeners = new Set<ChangeListener>()
    const messageListeners = new Set<MessageListener>()
    const createdTabs: Array<{ url: string }> = []
    const openTabs: FakeTab[] = []
    const tabUpdates: ChromeFake['tabUpdates'] = []
    const windowUpdates: ChromeFake['windowUpdates'] = []
    const removedTabIds: ChromeFake['removedTabIds'] = []
    let currentTab: FakeTab | undefined
    let nextTabId = 1

    const emit = (changes: StorageChanges, areaName = 'local'): void => {
        listeners.forEach(listener => listener(changes, areaName))
    }

    // local and session differ only in their backing Map and the areaName
    // they emit under — share one implementation so the two can't drift.
    const createStorageArea = (
        map: Map<string, unknown>,
        areaName: string,
    ) => ({
        get: async (
            keys?: null | string | string[],
        ): Promise<Record<string, unknown>> => {
            if (keys == null) return Object.fromEntries(map)
            const wanted = typeof keys === 'string' ? [keys] : keys
            return Object.fromEntries(
                wanted
                    .filter(key => map.has(key))
                    .map(key => [key, map.get(key)]),
            )
        },
        set: async (items: Record<string, unknown>): Promise<void> => {
            const changes: StorageChanges = {}
            for (const [key, value] of Object.entries(items)) {
                changes[key] = { oldValue: map.get(key), newValue: value }
                map.set(key, value)
            }
            emit(changes, areaName)
        },
        remove: async (keys: string | string[]): Promise<void> => {
            const changes: StorageChanges = {}
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                changes[key] = { oldValue: map.get(key) }
                map.delete(key)
            }
            emit(changes, areaName)
        },
    })

    const local = createStorageArea(data, 'local')

    const sessionData = new Map<string, unknown>()
    const accessLevels: string[] = []

    const session = {
        ...createStorageArea(sessionData, 'session'),
        setAccessLevel: async (options: {
            accessLevel: string
        }): Promise<void> => {
            accessLevels.push(options.accessLevel)
        },
    }

    const alarms = new Map<
        string,
        { periodInMinutes?: number; delayInMinutes?: number }
    >()
    const alarmListeners = new Set<(alarm: { name: string }) => void>()

    const fireAlarm = async (name: string): Promise<void> => {
        if (!alarms.has(name)) return
        for (const listener of alarmListeners) listener({ name })
        // Alarm handlers are async void by Chrome's contract; yield so their
        // microtasks settle before the test asserts.
        await Promise.resolve()
    }

    const fake = {
        runtime: {
            id: TEST_EXTENSION_ID,
            getManifest: () => ({
                manifest_version: 3,
                name: 'Pera Wallet',
                version: '0.1.0',
            }),
            getURL: (path: string) =>
                `chrome-extension://${TEST_EXTENSION_ID}/${path}`,
            // senderOverride simulates a different caller (a non-offscreen
            // extension page, or a content-script-shaped sender whose
            // sender.url is the web page it was injected into) — the real
            // chrome.runtime.sendMessage never takes this; it's fixture-only.
            sendMessage: async (
                message: unknown,
                senderOverride?: Partial<typeof DEFAULT_SENDER>,
            ): Promise<unknown> => {
                if (messageListeners.size === 0) {
                    throw new Error(
                        'Could not establish connection. Receiving end does not exist.',
                    )
                }
                const sender = { ...DEFAULT_SENDER, ...senderOverride }
                return new Promise((resolve, reject) => {
                    let responded = false
                    let anyKeptAlive = false
                    // Every listener sees the message, exactly as in Chrome —
                    // don't stop at the first one that keeps the port open, or
                    // a later listener's synchronous response is never
                    // delivered.
                    for (const listener of messageListeners) {
                        const keepAlive = listener(
                            message,
                            sender,
                            response => {
                                if (responded) return
                                responded = true
                                resolve(response)
                            },
                        )
                        if (keepAlive === true) anyKeptAlive = true
                    }
                    if (responded || anyKeptAlive) return
                    // Chrome closes the port when listeners exist but none
                    // answered and none asked to answer later. Modelling this
                    // as resolve(undefined) is what hid a whole class of bug:
                    // callers that `await` a send whose listener never calls
                    // sendResponse look fine under a resolving fake and then
                    // fire their failure paths on every success in a real
                    // browser.
                    reject(
                        new Error(
                            'The message port closed before a response was received.',
                        ),
                    )
                })
            },
            onMessage: {
                addListener: (listener: MessageListener) =>
                    messageListeners.add(listener),
                removeListener: (listener: MessageListener) =>
                    messageListeners.delete(listener),
            },
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
                info: {
                    periodInMinutes?: number
                    delayInMinutes?: number
                },
            ): Promise<void> => {
                alarms.set(name, info)
            },
            clear: async (name: string): Promise<boolean> =>
                alarms.delete(name),
            getAll: async (): Promise<
                Array<{
                    name: string
                    periodInMinutes?: number
                    delayInMinutes?: number
                }>
            > =>
                [...alarms.entries()].map(([name, info]) => ({
                    name,
                    ...info,
                })),
            onAlarm: {
                addListener: (listener: (alarm: { name: string }) => void) => {
                    alarmListeners.add(listener)
                },
                removeListener: (
                    listener: (alarm: { name: string }) => void,
                ) => {
                    alarmListeners.delete(listener)
                },
            },
        },
        tabs: {
            create: async (props: { url: string }) => {
                createdTabs.push(props)
                const tab: FakeTab = {
                    id: nextTabId++,
                    url: props.url,
                    windowId: nextTabId,
                }
                openTabs.push(tab)
                return tab
            },
            query: async (queryInfo: { url?: string }): Promise<FakeTab[]> => {
                if (!queryInfo.url) return [...openTabs]
                // Fixture-only glob: chrome's real match patterns are far
                // richer, but every caller here only needs a trailing '*'.
                const prefix = queryInfo.url.endsWith('*')
                    ? queryInfo.url.slice(0, -1)
                    : queryInfo.url
                return openTabs.filter(tab => tab.url.startsWith(prefix))
            },
            update: async (
                tabId: number,
                changes: { url?: string; active?: boolean },
            ): Promise<FakeTab | undefined> => {
                tabUpdates.push({ id: tabId, changes })
                const tab = openTabs.find(t => t.id === tabId)
                if (tab && changes.url !== undefined) tab.url = changes.url
                return tab
            },
            getCurrent: async (): Promise<FakeTab | undefined> => currentTab,
            remove: async (tabId: number): Promise<void> => {
                removedTabIds.push(tabId)
                const index = openTabs.findIndex(t => t.id === tabId)
                if (index !== -1) openTabs.splice(index, 1)
            },
        },
        windows: {
            update: async (
                windowId: number,
                changes: { focused?: boolean },
            ): Promise<{ id: number }> => {
                windowUpdates.push({ windowId, changes })
                return { id: windowId }
            },
        },
    }

    return {
        chrome: fake as unknown as typeof chrome,
        data,
        emitExternalChange: (key, newValue, areaName = 'local') => {
            const oldValue = data.get(key)
            data.set(key, newValue)
            emit({ [key]: { oldValue, newValue } }, areaName)
        },
        messageListeners,
        createdTabs,
        openTabs,
        tabUpdates,
        windowUpdates,
        setCurrentTab: (tab: FakeTab | undefined) => {
            currentTab = tab
        },
        removedTabIds,
        sessionData,
        accessLevels,
        alarms,
        fireAlarm,
    }
}
