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

import type { DbMethod } from './protocol'
import type { SqlExecutor } from './host'

type WorkerResponse =
    | { id: number; ok: true; rows: unknown[][] }
    | { id: number; ok: false; error: string }

// Startup failure announced by the worker itself — see db-worker.ts. A failed
// sqlite/OPFS init raises no 'error' event, so without this the worker would
// look alive while answering nothing, and the death-driven recovery path
// (host un-ready -> offscreen self-close -> recreate) would never run.
type WorkerFatal = { fatal: true; error: string }

const isWorkerFatal = (value: unknown): value is WorkerFatal =>
    typeof value === 'object' &&
    value !== null &&
    (value as WorkerFatal).fatal === true

/** Correlates request/response pairs with the db worker by id. */
export const createWorkerExecutor = (worker: Worker): SqlExecutor => {
    let nextId = 1
    let isDead = false
    let deadError: Error | null = null
    const pending = new Map<
        number,
        { resolve: (rows: unknown[][]) => void; reject: (error: Error) => void }
    >()
    // Multiple independent observers (DatabaseHost's ready flip, the
    // offscreen bootstrap's self-close) each register their own listener
    // rather than sharing one slot.
    const deathListeners: Array<(error: Error) => void> = []

    const handleWorkerCrash = (error: Error): void => {
        // 'error' and 'messageerror' can both fire for the same crash —
        // only the first is real, later ones would double-notify listeners.
        if (isDead) return
        isDead = true
        deadError = error
        const entries = Array.from(pending.values())
        pending.clear()
        for (const entry of entries) {
            entry.reject(error)
        }
        for (const listener of deathListeners) {
            listener(error)
        }
    }

    worker.addEventListener('message', event => {
        const data = (event as MessageEvent).data as unknown
        if (isWorkerFatal(data)) {
            handleWorkerCrash(
                new Error(`db worker failed to start: ${data.error}`),
            )
            return
        }
        const response = data as WorkerResponse
        const entry = pending.get(response?.id)
        if (!entry) return
        pending.delete(response.id)
        if (response.ok) entry.resolve(response.rows)
        else entry.reject(new Error(response.error))
    })

    worker.addEventListener('error', event => {
        const errorMsg = event.message || 'unknown error'
        handleWorkerCrash(new Error(`db worker crashed: ${errorMsg}`))
    })

    worker.addEventListener('messageerror', event => {
        const errorMsg = event.data?.message || 'message deserialization failed'
        handleWorkerCrash(new Error(`db worker crashed: ${errorMsg}`))
    })

    const post = (message: Record<string, unknown>): Promise<unknown[][]> =>
        new Promise((resolve, reject) => {
            if (isDead) {
                reject(deadError || new Error('db worker crashed'))
                return
            }
            const id = nextId++
            pending.set(id, { resolve, reject })
            worker.postMessage({ ...message, id })
        })

    return {
        exec: (
            name: string,
            sql: string,
            params: unknown[],
            method: DbMethod,
        ) => post({ op: 'exec', name, sql, params, method }),
        deleteDatabase: async (name: string) => {
            await post({ op: 'delete', name })
        },
        onDeath: (callback: (error: Error) => void) => {
            // Already dead by the time a listener registers (e.g. a host
            // constructed after the crash) — fire immediately rather than
            // silently dropping the notification.
            if (isDead && deadError) {
                callback(deadError)
                return
            }
            deathListeners.push(callback)
        },
    }
}
