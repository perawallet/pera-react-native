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

import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type {
    Database,
    DatabaseDriver,
    DatabaseService,
} from '@perawallet/wallet-extension-platform'
import {
    DB_CONTROL_SCOPE,
    DB_SCOPE,
    decodeWireValues,
    encodeWireValues,
    type DbDeleteMessage,
    type DbExecMessage,
    type DbExecResponse,
    type DbMethod,
    type DbPingResponse,
} from '../database/protocol'
import { getActiveDatabaseHost } from '../database/host'

const EXEC_TIMEOUT_MS = 10_000
const READY_POLL_INTERVAL_MS = 250
const READY_WAIT_TIMEOUT_MS = 15_000

type ChromeDatabaseServiceOptions = {
    execTimeoutMs?: number
    readyPollIntervalMs?: number
    readyWaitTimeoutMs?: number
}

const withTimeout = async <T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`${label} timed out`)),
                    timeoutMs,
                )
            }),
        ])
    } finally {
        clearTimeout(timer)
    }
}

const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms))

// The wire contract keeps `rows` uniform, but drizzle's sqlite-proxy session
// does not: for method 'get' it expects `rows` to already BE the single row.
// Passing the array through would make db.get() return `[[...]]`, and worse,
// never return undefined for no match — its falsy check can't see through a
// truthy `[]`. `rows[0]` is exactly `undefined` when the host found nothing.
//
// The cast bridges drizzle's own `rows: any[]`, which doesn't reflect this
// get-vs-all split; it isn't widening our types.
const toDrizzleRows = (
    rows: unknown[][],
    method: string,
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
): any[] => (method === 'get' ? rows[0] : rows) as any[]

class ChromeDatabaseDriver implements DatabaseDriver {
    constructor(readonly driver: unknown) {}
}

/**
 * A definitive host-side answer: the SQL itself failed (bad statement,
 * missing table, constraint violation, ...). Distinct from every other throw
 * in execOnce, which are all transport-level (no response / timeout /
 * not-ready) — see the retry-scoping comment on `exec()`.
 */
class DbExecFailedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DbExecFailedError'
    }
}

/**
 * Drizzle sqlite-proxy driver over chrome.runtime messaging. The offscreen
 * document owns sqlite-wasm on OPFS (single writer by construction — OPFS
 * sync access handles are exclusive); every other context proxies through
 * this service. In the offscreen document itself, the active DatabaseHost
 * short-circuits messaging and executes locally.
 *
 * Error posture (per the design spec): exec has a timeout with ONE retry
 * after asking the service worker to (re)create the offscreen document.
 */
export class ChromeDatabaseService implements DatabaseService {
    private readonly execTimeoutMs: number
    private readonly readyPollIntervalMs: number
    private readonly readyWaitTimeoutMs: number

    constructor(options: ChromeDatabaseServiceOptions = {}) {
        this.execTimeoutMs = options.execTimeoutMs ?? EXEC_TIMEOUT_MS
        this.readyPollIntervalMs =
            options.readyPollIntervalMs ?? READY_POLL_INTERVAL_MS
        this.readyWaitTimeoutMs =
            options.readyWaitTimeoutMs ?? READY_WAIT_TIMEOUT_MS
    }

    async open(name: string): Promise<DatabaseDriver> {
        await this.ensureHostAvailable()
        return new ChromeDatabaseDriver(`offscreen-proxy:${name}`)
    }

    async getDatabase(name: string): Promise<Database> {
        const host = getActiveDatabaseHost()
        if (host) {
            // We ARE the offscreen document: execute against the worker
            // directly (the host is also who runs migrations, before ready).
            return drizzle(async (sql, params, method) => ({
                rows: toDrizzleRows(
                    await host.execLocal(name, sql, params, method),
                    method,
                ),
            }))
        }
        await this.ensureHostAvailable()
        return drizzle(async (sql, params, method) => ({
            rows: toDrizzleRows(
                await this.exec(name, sql, params, method as DbMethod),
                method,
            ),
        }))
    }

    async close(_name: string): Promise<void> {
        // The offscreen document owns the connection lifecycle; proxied
        // contexts have nothing to close.
    }

    async delete(name: string): Promise<void> {
        const message: DbDeleteMessage = {
            scope: DB_SCOPE,
            kind: 'delete',
            name,
        }
        const response = (await withTimeout(
            chrome.runtime.sendMessage(message),
            this.execTimeoutMs,
            'db delete',
        )) as DbExecResponse
        if (!response?.ok) {
            throw new Error(
                `Failed to delete database "${name}": ${response?.error ?? 'no response'}`,
            )
        }
    }

    private async exec(
        name: string,
        sql: string,
        params: unknown[],
        method: DbMethod,
    ): Promise<unknown[][]> {
        try {
            return await this.execOnce(name, sql, params, method)
        } catch (error) {
            // Transport-level failures only. A definitive SQL error will fail
            // identically on retry, so retrying just doubles latency.
            //
            // A timeout is ambiguous — the write may already have landed
            // host-side — but every schema here upserts idempotently, so
            // retrying one is safe.
            if (error instanceof DbExecFailedError) throw error
            await this.ensureHostAvailable()
            return this.execOnce(name, sql, params, method)
        }
    }

    private async execOnce(
        name: string,
        sql: string,
        params: unknown[],
        method: DbMethod,
    ): Promise<unknown[][]> {
        const message: DbExecMessage = {
            scope: DB_SCOPE,
            kind: 'exec',
            name,
            sql,
            params: encodeWireValues(params),
            method,
        }
        const response = (await withTimeout(
            chrome.runtime.sendMessage(message),
            this.execTimeoutMs,
            'db exec',
        )) as DbExecResponse | undefined
        if (!response) throw new Error('db exec got no response')
        if (!response.ok) {
            const message = `db exec failed (${response.code}): ${response.error}`
            // 'not-ready' is transport-shaped (host mid-boot/recreation) and
            // stays a plain Error so exec()'s retry still applies; only
            // 'exec-failed' (a definitive SQL error) is tagged to skip it.
            if (response.code === 'exec-failed') {
                throw new DbExecFailedError(message)
            }
            throw new Error(message)
        }
        return response.rows.map(row => decodeWireValues(row))
    }

    private async ensureHostAvailable(): Promise<void> {
        const deadline = Date.now() + this.readyWaitTimeoutMs
        let askedServiceWorker = false
        while (Date.now() < deadline) {
            try {
                // Timeout-wrapped like exec/delete: a listener that accepts
                // the message (keeping the port alive) but never calls
                // sendResponse — e.g. a host stuck mid-init — must not stall
                // this poll iteration past the deadline.
                const pong = (await withTimeout(
                    chrome.runtime.sendMessage({
                        scope: DB_SCOPE,
                        kind: 'ping',
                    }),
                    this.readyPollIntervalMs,
                    'db ping',
                )) as DbPingResponse | undefined
                if (pong?.ok && pong.ready) return
            } catch {
                // No receiver yet, or the ping above timed out — keep
                // polling until the overall deadline.
            }
            if (!askedServiceWorker) {
                askedServiceWorker = true
                try {
                    // Concurrent callers (e.g. several UI contexts booting at
                    // once) may each reach this branch and send
                    // ensure-offscreen independently. That's fine only
                    // because offscreen-document creation is assumed
                    // idempotent (T5): the service worker's
                    // chrome.offscreen.createDocument call is a no-op/safe
                    // if a document already exists or is being created.
                    await chrome.runtime.sendMessage({
                        scope: DB_CONTROL_SCOPE,
                        kind: 'ensure-offscreen',
                    })
                } catch {
                    // SW asleep mid-restart: the next ping loop iteration
                    // retries; sendMessage itself wakes the SW.
                    askedServiceWorker = false
                }
            }
            await sleep(this.readyPollIntervalMs)
        }
        throw new Error(
            'Offscreen database host unavailable: the offscreen document ' +
                'never reported ready. Check the background service worker ' +
                'and offscreen bootstrap.',
        )
    }
}
