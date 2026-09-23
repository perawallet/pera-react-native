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

type Areas = { local: Map<string, unknown>; session: Map<string, unknown> }

type MessageListener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
) => boolean | undefined | void

type AlarmInfo = { periodInMinutes?: number; when?: number }

type PortMessageHandler = (message: unknown, port: chrome.runtime.Port) => void
type PortDisconnectHandler = (port: chrome.runtime.Port) => void

export type FakePort = {
    port: chrome.runtime.Port
    sent: unknown[]
    /** The worker called port.disconnect(). */
    isDisconnected: () => boolean
    deliver: (message: unknown) => void
    /** The other end went away (page closed): fires the worker's onDisconnect listeners. */
    close: () => void
}

export type LocalChromeFake = {
    chrome: typeof chrome
    local: Map<string, unknown>
    session: Map<string, unknown>
    alarms: Map<string, AlarmInfo>
    tabs: Map<number, { url?: string }>
    fireAlarm: (name: string) => Promise<void>
    sendMessage: (
        message: unknown,
        sender: chrome.runtime.MessageSender,
    ) => Promise<unknown>
    connectPort: (
        name: string,
        sender: chrome.runtime.MessageSender,
    ) => FakePort
    closeTab: (tabId: number) => void
}

export const EXTENSION_PAGE_SENDER: chrome.runtime.MessageSender = {
    id: 'ext-id',
    url: 'chrome-extension://ext-id/popup.html',
}

const area = (store: Map<string, unknown>) => ({
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
        for (const [key, value] of Object.entries(items)) store.set(key, value)
    },
    remove: async (keys: string | string[]) => {
        for (const key of typeof keys === 'string' ? [keys] : keys) {
            store.delete(key)
        }
    },
    setAccessLevel: async () => {},
})

export const createLocalChromeFake = (): LocalChromeFake => {
    const areas: Areas = { local: new Map(), session: new Map() }
    const alarms = new Map<string, AlarmInfo>()
    const alarmListeners = new Set<(alarm: { name: string }) => void>()
    const messageListeners = new Set<MessageListener>()
    const connectListeners = new Set<(port: chrome.runtime.Port) => void>()
    const tabRemovedListeners = new Set<(tabId: number) => void>()
    const tabs = new Map<number, { url?: string }>()
    let nextTabId = 100

    const fireAlarm = async (name: string): Promise<void> => {
        if (!alarms.has(name)) return
        for (const listener of alarmListeners) listener({ name })
        await Promise.resolve()
    }

    const sendMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
    ): Promise<unknown> =>
        new Promise((resolve, reject) => {
            let hasResponded = false
            let isAsync = false
            const respond = (response?: unknown): void => {
                if (hasResponded) return
                hasResponded = true
                resolve(response)
            }
            for (const listener of messageListeners) {
                if (listener(message, sender, respond) === true) {
                    isAsync = true
                }
            }
            if (!hasResponded && !isAsync) {
                reject(
                    new Error(
                        'The message port closed before a response was received.',
                    ),
                )
            }
        })

    const connectPort = (
        name: string,
        sender: chrome.runtime.MessageSender,
    ): FakePort => {
        const messageHandlers = new Set<PortMessageHandler>()
        const disconnectHandlers = new Set<PortDisconnectHandler>()
        const sent: unknown[] = []
        let isDisconnected = false
        const port = {
            name,
            sender,
            postMessage: (message: unknown) => sent.push(message),
            disconnect: () => {
                isDisconnected = true
            },
            onMessage: {
                addListener: (handler: PortMessageHandler) =>
                    messageHandlers.add(handler),
                removeListener: (handler: PortMessageHandler) =>
                    messageHandlers.delete(handler),
            },
            // Chrome fires onDisconnect only on the side that did NOT call disconnect().
            onDisconnect: {
                addListener: (handler: PortDisconnectHandler) =>
                    disconnectHandlers.add(handler),
                removeListener: (handler: PortDisconnectHandler) =>
                    disconnectHandlers.delete(handler),
            },
        } as unknown as chrome.runtime.Port
        for (const listener of connectListeners) listener(port)
        return {
            port,
            sent,
            isDisconnected: () => isDisconnected,
            deliver: message => {
                for (const handler of messageHandlers) handler(message, port)
            },
            close: () => {
                for (const handler of disconnectHandlers) handler(port)
            },
        }
    }

    const closeTab = (tabId: number): void => {
        tabs.delete(tabId)
        for (const listener of tabRemovedListeners) listener(tabId)
    }

    const fake = {
        runtime: {
            id: 'ext-id',
            getURL: (path: string) => `chrome-extension://ext-id/${path}`,
            onMessage: {
                addListener: (listener: MessageListener) =>
                    messageListeners.add(listener),
                removeListener: (listener: MessageListener) =>
                    messageListeners.delete(listener),
            },
            onConnect: {
                addListener: (listener: (port: chrome.runtime.Port) => void) =>
                    connectListeners.add(listener),
                removeListener: (
                    listener: (port: chrome.runtime.Port) => void,
                ) => connectListeners.delete(listener),
            },
        },
        tabs: {
            create: async ({ url }: { url?: string }) => {
                const id = nextTabId++
                tabs.set(id, { url })
                return { id, url } as chrome.tabs.Tab
            },
            remove: async (tabId: number) => closeTab(tabId),
            onRemoved: {
                addListener: (listener: (tabId: number) => void) =>
                    tabRemovedListeners.add(listener),
                removeListener: (listener: (tabId: number) => void) =>
                    tabRemovedListeners.delete(listener),
            },
        },
        storage: {
            local: area(areas.local),
            session: area(areas.session),
            onChanged: {
                addListener: () => {},
                removeListener: () => {},
            },
        },
        alarms: {
            create: async (name: string, info: AlarmInfo) => {
                alarms.set(name, info)
            },
            clear: async (name: string) => alarms.delete(name),
            getAll: async () => [...alarms.keys()].map(name => ({ name })),
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
    }

    return {
        chrome: fake as unknown as typeof chrome,
        local: areas.local,
        session: areas.session,
        alarms,
        tabs,
        fireAlarm,
        sendMessage,
        connectPort,
        closeTab,
    }
}
