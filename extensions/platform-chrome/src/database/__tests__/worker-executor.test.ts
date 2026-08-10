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

import { describe, expect, it } from 'vitest'
import { createWorkerExecutor } from '../worker-executor'

type Listener = (event: any) => void

const createFakeWorker = () => {
    const listeners = new Map<string, Listener[]>()
    const posted: Array<Record<string, unknown>> = []
    return {
        posted,
        respond(response: Record<string, unknown>) {
            const messageListeners = listeners.get('message') || []
            for (const listener of messageListeners) {
                listener({ data: response } as MessageEvent)
            }
        },
        dispatchError(message: string) {
            const errorListeners = listeners.get('error') || []
            for (const listener of errorListeners) {
                listener({ message } as Event)
            }
        },
        dispatchMessageError(data: any) {
            const errorListeners = listeners.get('messageerror') || []
            for (const listener of errorListeners) {
                listener({ data } as Event)
            }
        },
        worker: {
            postMessage: (msg: Record<string, unknown>) => posted.push(msg),
            addEventListener: (type: string, listener: Listener) => {
                if (!listeners.has(type)) {
                    listeners.set(type, [])
                }
                listeners.get(type)!.push(listener)
            },
        } as unknown as Worker,
    }
}

describe('createWorkerExecutor', () => {
    it('correlates concurrent requests by id', async () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const a = executor.exec('pera.db', 'SELECT 1', [], 'get')
        const b = executor.exec('pera.db', 'SELECT 2', [], 'get')
        expect(fake.posted).toHaveLength(2)
        const [idA, idB] = fake.posted.map(m => m.id)
        fake.respond({ id: idB, ok: true, rows: [[2]] })
        fake.respond({ id: idA, ok: true, rows: [[1]] })
        expect(await a).toEqual([[1]])
        expect(await b).toEqual([[2]])
    })

    it('rejects on worker-reported failure', async () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const call = executor.exec('pera.db', 'BROKEN', [], 'run')
        fake.respond({
            id: fake.posted[0].id,
            ok: false,
            error: 'syntax error',
        })
        await expect(call).rejects.toThrow('syntax error')
    })

    it('rejects all pending calls when worker crashes', async () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const callA = executor.exec('pera.db', 'SELECT 1', [], 'get')
        const callB = executor.exec('pera.db', 'SELECT 2', [], 'get')
        expect(fake.posted).toHaveLength(2)
        fake.dispatchError('worker terminated')
        await expect(callA).rejects.toThrow(
            'db worker crashed: worker terminated',
        )
        await expect(callB).rejects.toThrow(
            'db worker crashed: worker terminated',
        )
    })

    it('rejects all pending calls when the worker reports a messageerror (undeserializable message)', async () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const callA = executor.exec('pera.db', 'SELECT 1', [], 'get')
        const callB = executor.exec('pera.db', 'SELECT 2', [], 'get')
        expect(fake.posted).toHaveLength(2)
        fake.dispatchMessageError({ message: 'could not deserialize' })
        await expect(callA).rejects.toThrow(
            'db worker crashed: could not deserialize',
        )
        await expect(callB).rejects.toThrow(
            'db worker crashed: could not deserialize',
        )
    })

    it('rejects new calls immediately after a messageerror, same as a worker crash', async () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const call1 = executor.exec('pera.db', 'SELECT 1', [], 'get')
        fake.dispatchMessageError({ message: 'could not deserialize' })
        await expect(call1).rejects.toThrow(
            'db worker crashed: could not deserialize',
        )
        const call2 = executor.exec('pera.db', 'SELECT 2', [], 'get')
        await expect(call2).rejects.toThrow('db worker crashed')
        expect(fake.posted).toHaveLength(1)
    })

    it('rejects new calls immediately after worker crashes', async () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const call1 = executor.exec('pera.db', 'SELECT 1', [], 'get')
        fake.dispatchError('worker terminated')
        await expect(call1).rejects.toThrow(
            'db worker crashed: worker terminated',
        )
        const call2 = executor.exec('pera.db', 'SELECT 2', [], 'get')
        await expect(call2).rejects.toThrow('db worker crashed')
        expect(fake.posted).toHaveLength(1)
    })

    it('notifies onDeath listeners exactly once on crash', () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const seen: Error[] = []
        executor.onDeath?.(error => seen.push(error))
        fake.dispatchError('worker terminated')
        expect(seen).toHaveLength(1)
        expect(seen[0].message).toBe('db worker crashed: worker terminated')
    })

    it('does not double-notify onDeath when both error and messageerror fire for the same crash', () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const seen: Error[] = []
        executor.onDeath?.(error => seen.push(error))
        fake.dispatchError('worker terminated')
        fake.dispatchMessageError({ message: 'could not deserialize' })
        expect(seen).toHaveLength(1)
    })

    it('fires onDeath immediately when registered after the worker already crashed', () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        fake.dispatchError('worker terminated')
        const seen: Error[] = []
        executor.onDeath?.(error => seen.push(error))
        expect(seen).toHaveLength(1)
        expect(seen[0].message).toBe('db worker crashed: worker terminated')
    })

    it('supports multiple independent onDeath listeners', () => {
        const fake = createFakeWorker()
        const executor = createWorkerExecutor(fake.worker)
        const seenA: Error[] = []
        const seenB: Error[] = []
        executor.onDeath?.(error => seenA.push(error))
        executor.onDeath?.(error => seenB.push(error))
        fake.dispatchError('worker terminated')
        expect(seenA).toHaveLength(1)
        expect(seenB).toHaveLength(1)
    })

    // A failed sqlite/OPFS init raises no 'error' event — the worker just
    // answers nothing forever. Treating its explicit fatal message as a crash
    // is what lets the offscreen document self-close and be recreated instead
    // of wedging the database until a manual extension reload.
    describe('a worker that fails to start', () => {
        it('treats the fatal startup message as a crash', () => {
            const fake = createFakeWorker()
            const executor = createWorkerExecutor(fake.worker)
            const seen: Error[] = []
            executor.onDeath?.(error => seen.push(error))

            fake.respond({
                fatal: true,
                error: 'NoModificationAllowedError',
            })

            expect(seen).toHaveLength(1)
            expect(seen[0].message).toBe(
                'db worker failed to start: NoModificationAllowedError',
            )
        })

        it('rejects in-flight and subsequent requests', async () => {
            const fake = createFakeWorker()
            const executor = createWorkerExecutor(fake.worker)
            const inFlight = executor.exec('pera.db', 'SELECT 1', [], 'all')

            fake.respond({ fatal: true, error: 'wasm load failed' })

            await expect(inFlight).rejects.toThrow(/failed to start/)
            await expect(
                executor.exec('pera.db', 'SELECT 1', [], 'all'),
            ).rejects.toThrow(/failed to start/)
        })

        it('does not mistake a fatal message for a response to request id 0', () => {
            const fake = createFakeWorker()
            const executor = createWorkerExecutor(fake.worker)
            const seen: Error[] = []
            executor.onDeath?.(error => seen.push(error))

            // The fatal message carries no id at all; a naive `pending.get(
            // response?.id)` lookup would simply miss and drop it silently.
            fake.respond({ fatal: true, error: 'boom' })

            expect(seen).toHaveLength(1)
        })
    })
})
