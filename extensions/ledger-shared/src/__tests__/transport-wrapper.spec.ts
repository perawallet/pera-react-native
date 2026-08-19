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

import { describe, it, expect, vi } from 'vitest'
import type { AlgorandApp } from '@algorandfoundation/ledger-algorand-js'
import {
    createLedgerTransportWrapper,
    type LedgerAppTransport,
} from '../transport-wrapper'

// The APDU surface is exercised through the transport specs; these tests only
// cover the disconnect-event passthrough, so a bare stub is enough.
const stubApp = {} as AlgorandApp

describe('createLedgerTransportWrapper disconnect events', () => {
    it('exposes onDisconnect only when the transport emits events', () => {
        const withoutEvents: LedgerAppTransport = {
            close: vi.fn().mockResolvedValue(undefined),
        }

        // Callers branch on this being absent to fall back to their timeout,
        // so it must not be a no-op subscriber that never fires.
        expect(
            createLedgerTransportWrapper(withoutEvents, stubApp).onDisconnect,
        ).toBeUndefined()
    })

    it('forwards a disconnect to the listener and unsubscribes on demand', () => {
        const listeners: Array<() => void> = []
        const transport: LedgerAppTransport = {
            close: vi.fn().mockResolvedValue(undefined),
            on: vi.fn((_event, listener: () => void) => {
                listeners.push(listener)
            }),
            off: vi.fn(),
        }

        const wrapper = createLedgerTransportWrapper(transport, stubApp)
        const onDisconnected = vi.fn()
        const unsubscribe = wrapper.onDisconnect?.(onDisconnected)

        expect(transport.on).toHaveBeenCalledWith(
            'disconnect',
            expect.any(Function),
        )

        listeners[0]?.()
        expect(onDisconnected).toHaveBeenCalledTimes(1)

        unsubscribe?.()
        expect(transport.off).toHaveBeenCalledWith('disconnect', onDisconnected)
    })
})
