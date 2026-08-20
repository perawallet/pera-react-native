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

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { BackupWebSocketClient, type WebSocketLike } from '../webSocketClient'

const makeFakeSocket = () => {
    const s: WebSocketLike & { _open: () => void; _msg: (d: unknown) => void; _close: (c?: number) => void } = {
        onopen: null, onmessage: null, onerror: null, onclose: null,
        close: vi.fn(),
        _open: () => s.onopen?.(),
        _msg: (d: unknown) => s.onmessage?.({ data: d }),
        _close: (c = 1006) => s.onclose?.({ code: c }),
    }
    return s
}

const baseDeps = () => ({
    baseUrl: 'https://b.test/',
    backupId: 'did:pera:ABC',
    deviceId: 'dev',
    timestamp: () => '2026-06-25T00:00:00.000Z',
    // Cast: vi.fn infers a concrete T=string mock, which TS won't assign to the
    // generic `withAuthSecretKey<T>` signature. The runtime behaviour is correct;
    // the cast only satisfies the type-checker (the mock is never asserted on).
    withAuthSecretKey: vi.fn(async (fn: (k: Uint8Array) => string) =>
        fn(new Uint8Array(64).fill(1)),
    ) as never,
    buildToken: vi.fn(() => 'sig'),
})

describe('BackupWebSocketClient', () => {
    it('connects with a token-bearing url and emits connected + itemsUpdated', async () => {
        const sock = makeFakeSocket()
        const events: unknown[] = []
        const client = new BackupWebSocketClient({
            ...baseDeps(),
            socketFactory: () => sock,
            scheduler: { setTimeout: (() => 0) as never, clearTimeout: () => undefined },
            onEvent: e => events.push(e),
        })
        await client.connect()
        sock._open()
        sock._msg(JSON.stringify({ type: 'ITEMS_UPDATED', from_seq: 5, to_seq: 7 }))
        expect(events).toContainEqual({ kind: 'connected' })
        expect(events).toContainEqual({ kind: 'itemsUpdated', fromSeq: 5, toSeq: 7 })
    })

    it('emits backupDeleted on a BACKUP_DELETED message', async () => {
        const sock = makeFakeSocket()
        const events: unknown[] = []
        const client = new BackupWebSocketClient({
            ...baseDeps(), socketFactory: () => sock,
            scheduler: { setTimeout: (() => 0) as never, clearTimeout: () => undefined },
            onEvent: e => events.push(e),
        })
        await client.connect()
        sock._msg(JSON.stringify({ type: 'BACKUP_DELETED' }))
        expect(events).toContainEqual({ kind: 'backupDeleted' })
    })

    it('reconnects with backoff on an unexpected close, building a FRESH token each time', async () => {
        const sockets = [makeFakeSocket(), makeFakeSocket()]
        let i = 0
        const deps = baseDeps()
        const scheduled: Array<() => void> = []
        const client = new BackupWebSocketClient({
            ...deps,
            socketFactory: () => sockets[i++],
            scheduler: { setTimeout: ((fn: () => void) => { scheduled.push(fn); return 1 }) as never, clearTimeout: () => undefined },
            onEvent: () => undefined,
        })
        await client.connect()
        sockets[0]._open()
        sockets[0]._close(1006)
        expect(scheduled).toHaveLength(1)
        await scheduled[0]()
        expect(deps.buildToken).toHaveBeenCalledTimes(2)
    })

    it('does NOT reconnect after disconnect() (manual close)', async () => {
        const sock = makeFakeSocket()
        const scheduled: Array<() => void> = []
        const client = new BackupWebSocketClient({
            ...baseDeps(), socketFactory: () => sock,
            scheduler: { setTimeout: ((fn: () => void) => { scheduled.push(fn); return 1 }) as never, clearTimeout: () => undefined },
            onEvent: () => undefined,
        })
        await client.connect()
        client.disconnect()
        sock._close(1000)
        expect(scheduled).toHaveLength(0)
    })
})
