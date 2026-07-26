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

import {
    decodeWireValues,
    encodeWireValues,
    isDbMessage,
    type DbExecResponse,
    type DbMethod,
    type DbPingResponse,
} from './protocol'
import { isTrustedExtensionPageSender } from '../trusted-sender'

export type SqlExecutor = {
    exec(
        name: string,
        sql: string,
        params: unknown[],
        method: DbMethod,
    ): Promise<unknown[][]>
    deleteDatabase(name: string): Promise<void>
    /**
     * Registers a callback fired once the executor becomes permanently
     * unusable (e.g. the underlying worker crashed). Optional: fixtures/test
     * executors may omit it, in which case the host simply never learns of
     * a death and stays reporting whatever `ready` it was last set to.
     */
    onDeath?(callback: (error: Error) => void): void
}

/**
 * Runs in the offscreen document only: bridges chrome.runtime DB messages to
 * the sqlite-wasm worker. Exec is refused until setReady() — the offscreen
 * bootstrap flips it only after migrations have run locally, which makes the
 * offscreen document the single migration runner by construction (UI-side
 * initializeDatabase re-runs are skip-only reads).
 */
export class DatabaseHost {
    private ready = false

    constructor(private readonly executor: SqlExecutor) {
        // A dead worker must not leave the host self-reporting healthy: ping
        // would otherwise keep answering ready:true forever, and
        // ensureOffscreenDocument (which only checks document existence)
        // would never recreate anything. Flipping ready back to false here
        // makes ChromeDatabaseService's ensureHostAvailable retry loop see a
        // real failure and drive recovery (see runOffscreenApp's self-close
        // wiring for the other half of that recovery path).
        executor.onDeath?.(() => {
            this.ready = false
        })
    }

    listen(): void {
        chrome.runtime.onMessage.addListener(this.handleMessage)
    }

    setReady(): void {
        this.ready = true
    }

    async execLocal(
        name: string,
        sql: string,
        params: unknown[],
        method: string | DbMethod,
    ): Promise<unknown[][]> {
        return this.executor.exec(name, sql, params, method as DbMethod)
    }

    private handleMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void,
    ): boolean | undefined => {
        if (!isDbMessage(message)) return undefined
        // Threat model: content scripts share this onMessage listener with
        // every extension page. Trusted senders are our own popup/expanded/
        // approval/offscreen pages and the service worker itself (also
        // extension-origin) — refuse anyone else with no response at all
        // (DbPingResponse has no ok:false shape, so silence is the only
        // refusal that can't be confused with a real answer).
        if (!isTrustedExtensionPageSender(sender)) return undefined
        if (message.kind === 'ping') {
            const pong: DbPingResponse = { ok: true, ready: this.ready }
            sendResponse(pong)
            return undefined
        }
        if (!this.ready) {
            const notReady: DbExecResponse = {
                ok: false,
                code: 'not-ready',
                error: 'Offscreen database host is not ready yet (migrations pending).',
            }
            sendResponse(notReady)
            return undefined
        }
        const respond = async (): Promise<DbExecResponse> => {
            try {
                if (message.kind === 'delete') {
                    await this.executor.deleteDatabase(message.name)
                    return { ok: true, rows: [] }
                }
                const rows = await this.executor.exec(
                    message.name,
                    message.sql,
                    decodeWireValues(message.params),
                    message.method,
                )
                return {
                    ok: true,
                    rows: rows.map(row => encodeWireValues(row)),
                }
            } catch (error) {
                return {
                    ok: false,
                    code: 'exec-failed',
                    error:
                        error instanceof Error ? error.message : String(error),
                }
            }
        }
        void respond().then(sendResponse)
        return true // async sendResponse
    }
}

let activeHost: DatabaseHost | null = null

export const setActiveDatabaseHost = (host: DatabaseHost | null): void => {
    activeHost = host
}

export const getActiveDatabaseHost = (): DatabaseHost | null => activeHost

export const startDatabaseHost = (executor: SqlExecutor): DatabaseHost => {
    const host = new DatabaseHost(executor)
    host.listen()
    setActiveDatabaseHost(host)
    return host
}
