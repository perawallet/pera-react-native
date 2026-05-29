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

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fake socket returned by io()
const makeFakeSocket = () => ({
    id: 'socket-id-1',
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
})

type FakeSocket = ReturnType<typeof makeFakeSocket>
let fakeSocket: FakeSocket

vi.mock('socket.io-client', () => ({
    io: vi.fn((_url: string, _opts: unknown) => fakeSocket),
}))

import { io } from 'socket.io-client'
import { SignalClient } from '../vendor/signalClient'

beforeEach(() => {
    fakeSocket = makeFakeSocket()
    vi.mocked(io).mockReturnValue(fakeSocket as never)
})

describe('SignalClient (vendored)', () => {
    it('generateRequestId() returns a non-empty string', () => {
        const id = SignalClient.generateRequestId()
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
    })

    it('constructor calls io(url, options) and registers connect/disconnect handlers', () => {
        const url = 'https://signal.example.com'
        const options = { autoConnect: false }
        new SignalClient(url, options)

        expect(io).toHaveBeenCalledWith(url, options)
        expect(fakeSocket.on).toHaveBeenCalledWith(
            'connect',
            expect.any(Function),
        )
        expect(fakeSocket.on).toHaveBeenCalledWith(
            'disconnect',
            expect.any(Function),
        )
    })

    it('link() emits link on the socket and resolves with the data when callback fires', async () => {
        const client = new SignalClient('https://signal.example.com')

        // Capture the link emit call so we can invoke the callback manually
        let linkCallback:
            | ((arg: { data: { wallet: string } }) => void)
            | undefined
        fakeSocket.emit.mockImplementation(
            (
                event: string,
                _payload: unknown,
                cb: (arg: { data: { wallet: string } }) => void,
            ) => {
                if (event === 'link') linkCallback = cb
            },
        )

        const promise = client.link('req-1')

        expect(fakeSocket.emit).toHaveBeenCalledWith(
            'link',
            { requestId: 'req-1' },
            expect.any(Function),
        )

        // Simulate server acknowledging the link
        linkCallback?.({ data: { wallet: 'w' } })

        const result = await promise
        expect(result).toEqual({ wallet: 'w' })
        expect(client.authenticated).toBe(true)
    })

    it('close() calls socket.removeAllListeners() and resets authenticated to false', () => {
        const client = new SignalClient('https://signal.example.com')
        // Manually set authenticated to simulate a prior link
        client.authenticated = true

        client.close()

        expect(fakeSocket.removeAllListeners).toHaveBeenCalled()
        expect(client.authenticated).toBe(false)
        expect(fakeSocket.disconnect).not.toHaveBeenCalled()
    })

    it('close(true) also calls socket.disconnect()', () => {
        const client = new SignalClient('https://signal.example.com')
        client.close(true)

        expect(fakeSocket.removeAllListeners).toHaveBeenCalled()
        expect(fakeSocket.disconnect).toHaveBeenCalled()
    })
})
