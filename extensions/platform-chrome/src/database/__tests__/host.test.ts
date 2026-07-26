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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { DB_SCOPE, type DbExecResponse, type DbPingResponse } from '../protocol'
import {
    setActiveDatabaseHost,
    startDatabaseHost,
    type SqlExecutor,
} from '../host'

const createFakeExecutor = (): SqlExecutor & { calls: unknown[][] } => {
    const calls: unknown[][] = []
    return {
        calls,
        exec: async (name, sql, params, method) => {
            // Validate inputs — the host must decode wire params first.
            expect(typeof name).toBe('string')
            expect(typeof sql).toBe('string')
            expect(Array.isArray(params)).toBe(true)
            calls.push([name, sql, params, method])
            return method === 'run' ? [] : [[42]]
        },
        deleteDatabase: async () => undefined,
    }
}

describe('DatabaseHost', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        setActiveDatabaseHost(null)
    })

    it('answers ping with its ready state', async () => {
        const host = startDatabaseHost(createFakeExecutor())
        const before = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'ping',
        })) as DbPingResponse
        expect(before).toEqual({ ok: true, ready: false })
        host.setReady()
        const after = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'ping',
        })) as DbPingResponse
        expect(after).toEqual({ ok: true, ready: true })
    })

    it('rejects exec with not-ready before setReady()', async () => {
        startDatabaseHost(createFakeExecutor())
        const response = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'exec',
            name: 'pera.db',
            sql: 'SELECT 1',
            params: [],
            method: 'get',
        })) as DbExecResponse
        expect(response).toEqual({
            ok: false,
            code: 'not-ready',
            error: expect.stringMatching(/not ready/i),
        })
    })

    it('decodes wire params, executes, and encodes result rows', async () => {
        const executor = createFakeExecutor()
        const host = startDatabaseHost(executor)
        host.setReady()
        const response = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'exec',
            name: 'pera.db',
            sql: 'SELECT ?',
            params: [{ __pera_u8: 'AAE=' }],
            method: 'get',
        })) as DbExecResponse
        expect(response).toEqual({ ok: true, rows: [[42]] })
        expect(executor.calls[0][2]).toEqual([new Uint8Array([0, 1])])
    })

    it('maps executor failures to exec-failed with the message', async () => {
        const host = startDatabaseHost({
            exec: vi.fn().mockRejectedValue(new Error('no such table: x')),
            deleteDatabase: vi.fn(),
        })
        host.setReady()
        const response = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'exec',
            name: 'pera.db',
            sql: 'SELECT * FROM x',
            params: [],
            method: 'all',
        })) as DbExecResponse
        expect(response).toEqual({
            ok: false,
            code: 'exec-failed',
            error: expect.stringContaining('no such table'),
        })
    })

    it('ignores foreign-scope messages', async () => {
        startDatabaseHost(createFakeExecutor())
        const response = await fake.chrome.runtime.sendMessage({
            scope: 'something-else',
        })
        expect(response).toBeUndefined()
    })

    it('answers ping from a trusted extension-page sender (e.g. popup)', async () => {
        const host = startDatabaseHost(createFakeExecutor())
        host.setReady()
        const response = (await fake.chrome.runtime.sendMessage(
            { scope: DB_SCOPE, kind: 'ping' },
            { url: 'chrome-extension://test-extension-id/popup.html' },
        )) as DbPingResponse
        expect(response).toEqual({ ok: true, ready: true })
    })

    it('answers ping from the service worker itself (its script is also extension-origin)', async () => {
        const host = startDatabaseHost(createFakeExecutor())
        host.setReady()
        const response = (await fake.chrome.runtime.sendMessage(
            { scope: DB_SCOPE, kind: 'ping' },
            {
                url: 'chrome-extension://test-extension-id/service-worker-loader.js',
            },
        )) as DbPingResponse
        expect(response).toEqual({ ok: true, ready: true })
    })

    it('refuses (no response) messages from a content-script-shaped sender', async () => {
        startDatabaseHost(createFakeExecutor())
        const response = await fake.chrome.runtime.sendMessage(
            { scope: DB_SCOPE, kind: 'ping' },
            { url: 'https://dapp.example' },
        )
        expect(response).toBeUndefined()
    })

    // M3 review finding: a dead worker must not leave the host permanently
    // self-reporting healthy — ChromeDatabaseService's ensureHostAvailable
    // trusts ping's ready:true at face value, so a stale-ready host would
    // never trigger offscreen-document recreation.
    it('flips ready back to false when the executor reports death, even after setReady()', async () => {
        let deathCallback: ((error: Error) => void) | undefined
        const executor: SqlExecutor = {
            exec: createFakeExecutor().exec,
            deleteDatabase: async () => undefined,
            onDeath: callback => {
                deathCallback = callback
            },
        }
        const host = startDatabaseHost(executor)
        host.setReady()
        const beforeDeath = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'ping',
        })) as DbPingResponse
        expect(beforeDeath).toEqual({ ok: true, ready: true })

        deathCallback?.(new Error('db worker crashed: worker terminated'))

        const afterDeath = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'ping',
        })) as DbPingResponse
        expect(afterDeath).toEqual({ ok: true, ready: false })
    })

    it('refuses exec with not-ready after the executor dies mid-session', async () => {
        let deathCallback: ((error: Error) => void) | undefined
        const executor: SqlExecutor = {
            exec: createFakeExecutor().exec,
            deleteDatabase: async () => undefined,
            onDeath: callback => {
                deathCallback = callback
            },
        }
        const host = startDatabaseHost(executor)
        host.setReady()
        deathCallback?.(new Error('db worker crashed'))

        const response = (await fake.chrome.runtime.sendMessage({
            scope: DB_SCOPE,
            kind: 'exec',
            name: 'pera.db',
            sql: 'SELECT 1',
            params: [],
            method: 'get',
        })) as DbExecResponse
        expect(response).toEqual({
            ok: false,
            code: 'not-ready',
            error: expect.stringMatching(/not ready/i),
        })
    })
})
