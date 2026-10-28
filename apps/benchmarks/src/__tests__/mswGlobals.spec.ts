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

import { afterEach, describe, expect, it, vi } from 'vitest'

const unsetGlobal = (name: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    Reflect.deleteProperty(globalThis, name)
    return () => {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    }
}

describe('mswGlobals', () => {
    const restores: (() => void)[] = []

    afterEach(() => {
        restores.splice(0).forEach(restore => restore())
        vi.resetModules()
    })

    it('installs the globals MSW needs at load time when the runtime has none', async () => {
        restores.push(
            unsetGlobal('MessageEvent'),
            unsetGlobal('BroadcastChannel'),
        )

        await import('../mswGlobals')
        class TypedEvent extends MessageEvent<number> {}
        const event = new TypedEvent('message', { data: 7, cancelable: true })
        const channel = new BroadcastChannel('msw:websocket-client-manager')

        expect(event).toBeInstanceOf(Event)
        expect(event.data).toBe(7)
        expect(event.cancelable).toBe(true)
        expect(() => channel.postMessage({})).not.toThrow()
        expect(channel).toBeInstanceOf(EventTarget)
    })
})
