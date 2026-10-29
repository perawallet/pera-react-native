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

import type { Nullable } from '@perawallet/wallet-core-shared'

// MSW touches web globals Hermes lacks at module scope (`class extends
// MessageEvent`, `new BroadcastChannel(...)` for its ws API): without these the
// bundle throws before React mounts and the app sits on the splash screen.
// RN installs `Event` and `EventTarget` before the entry module runs.

const defineGlobal = (name: string, value: unknown) => {
    if (name in globalThis) return
    Object.defineProperty(globalThis, name, {
        value,
        writable: true,
        configurable: true,
    })
}

class MessageEventPolyfill<T = unknown> extends Event {
    readonly data: T
    readonly origin: string
    readonly lastEventId: string
    readonly source: Nullable<MessageEventSource>
    readonly ports: readonly MessagePort[]

    constructor(type: string, init: MessageEventInit<T> = {}) {
        super(type, init)
        this.data = init.data as T
        this.origin = init.origin ?? ''
        this.lastEventId = init.lastEventId ?? ''
        this.source = init.source ?? null
        this.ports = init.ports ?? []
    }
}

// Only MSW's ws() handlers post on it, and the benchmarks register none.
class BroadcastChannelStub extends EventTarget {
    onmessage: Nullable<(event: MessageEvent) => void> = null
    onmessageerror: Nullable<(event: MessageEvent) => void> = null

    constructor(readonly name: string) {
        super()
    }

    postMessage(): void {}

    close(): void {}
}

defineGlobal('MessageEvent', MessageEventPolyfill)
defineGlobal('BroadcastChannel', BroadcastChannelStub)

export {}
