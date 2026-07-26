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

import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    DB_CONTROL_SCOPE,
    DB_SCOPE,
    type DbExecMessage,
    type DbExecResponse,
    type DbMessage,
} from '../../database/protocol'
import { ChromeDatabaseService } from '../database'

const installScriptedHost = (
    fake: ChromeFake,
    options: {
        ready?: boolean
        // Never call sendResponse for the ping — models a listener that
        // accepted the message (chrome keeps the message channel open) but
        // is stuck and never replies.
        pingHangs?: boolean
        // Override the exec response per-message; defaults to the canned
        // single-row/empty-row behavior below.
        respond?: (msg: DbExecMessage) => DbExecResponse
    } = {},
): { execCalls: DbExecMessage[] } => {
    const execCalls: DbExecMessage[] = []
    fake.messageListeners.add((message, _sender, sendResponse) => {
        const msg = message as DbMessage
        if (msg?.scope !== DB_SCOPE) return undefined
        if (msg.kind === 'ping') {
            if (options.pingHangs) return true
            sendResponse({ ok: true, ready: options.ready ?? true })
            return undefined
        }
        if (msg.kind === 'exec') {
            // Input validation: a malformed exec is a bug, not a fixture gap.
            expect(typeof msg.sql).toBe('string')
            expect(Array.isArray(msg.params)).toBe(true)
            expect(['run', 'all', 'values', 'get']).toContain(msg.method)
            expect(msg.name).toBe('pera.db')
            execCalls.push(msg)
            sendResponse(
                options.respond
                    ? options.respond(msg)
                    : msg.method === 'run'
                      ? { ok: true, rows: [] }
                      : { ok: true, rows: [[1, 'row']] },
            )
            return undefined
        }
        return undefined
    })
    return { execCalls }
}

describe('ChromeDatabaseService', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('round-trips a select through the drizzle proxy callback', async () => {
        const { execCalls } = installScriptedHost(fake)
        const service = new ChromeDatabaseService()
        const db = await service.getDatabase('pera.db')
        const rows = await db.values<[number, string]>(sql`SELECT 1, 'row'`)
        expect(rows).toEqual([[1, 'row']])
        expect(execCalls).toHaveLength(1)
    })

    it('asks the service worker to (re)create the offscreen doc when no host answers, then retries', async () => {
        const service = new ChromeDatabaseService({
            readyPollIntervalMs: 5,
            readyWaitTimeoutMs: 500,
        })
        // Control listener = fake service worker: on ensure-offscreen it
        // installs the host (models offscreen-document creation).
        const controlCalls: unknown[] = []
        fake.messageListeners.add((message, _sender, sendResponse) => {
            const msg = message as { scope?: string; kind?: string }
            if (msg?.scope !== DB_CONTROL_SCOPE) return undefined
            controlCalls.push(msg)
            installScriptedHost(fake)
            sendResponse({ ok: true })
            return undefined
        })
        const db = await service.getDatabase('pera.db')
        const rows = await db.values(sql`SELECT 1`)
        expect(rows).toEqual([[1, 'row']])
        expect(controlCalls).toHaveLength(1)
    })

    // M3 review finding: a dead db worker used to leave DatabaseHost
    // permanently self-reporting ready:true (see host.test.ts for the
    // isolated host-side fix). This test proves the OTHER half from the
    // ChromeDatabaseService side: once the host goes un-ready mid-session,
    // ensureHostAvailable's ping-fails → ensure-offscreen → new-doc loop
    // actually drives recovery, without needing a real worker crash.
    it('recovers once the host goes un-ready mid-session (host-unready → ensure-offscreen → recreated doc)', async () => {
        let hostReady = true
        const execCalls: DbExecMessage[] = []
        fake.messageListeners.add((message, _sender, sendResponse) => {
            const msg = message as DbMessage
            if (msg?.scope !== DB_SCOPE) return undefined
            if (msg.kind === 'ping') {
                sendResponse({ ok: true, ready: hostReady })
                return undefined
            }
            if (msg.kind === 'exec') {
                if (!hostReady) {
                    sendResponse({
                        ok: false,
                        code: 'not-ready',
                        error: 'Offscreen database host is not ready yet.',
                    })
                    return undefined
                }
                execCalls.push(msg)
                sendResponse({ ok: true, rows: [[1, 'row']] })
                return undefined
            }
            return undefined
        })
        const service = new ChromeDatabaseService({
            readyPollIntervalMs: 5,
            readyWaitTimeoutMs: 500,
        })
        const db = await service.getDatabase('pera.db')
        expect(await db.values(sql`SELECT 1, 'row'`)).toEqual([[1, 'row']])

        // The worker dies: DatabaseHost's onDeath wiring (host.ts) flips
        // ready back to false — modeled here directly on the fake host.
        hostReady = false

        // The service worker recreates the offscreen document on the next
        // ensure-offscreen request; its bootstrap reruns migrations and
        // calls host.setReady() again.
        fake.messageListeners.add((message, _sender, sendResponse) => {
            const msg = message as { scope?: string; kind?: string }
            if (msg?.scope !== DB_CONTROL_SCOPE) return undefined
            hostReady = true
            sendResponse({ ok: true })
            return undefined
        })

        expect(await db.values(sql`SELECT 1, 'row'`)).toEqual([[1, 'row']])
        expect(execCalls).toHaveLength(2)
    })

    it('fails loudly when the host never becomes ready', async () => {
        installScriptedHost(fake, { ready: false })
        fake.messageListeners.add((message, _s, sendResponse) => {
            const msg = message as { scope?: string }
            if (msg?.scope !== DB_CONTROL_SCOPE) return undefined
            sendResponse({ ok: true })
            return undefined
        })
        const service = new ChromeDatabaseService({
            readyPollIntervalMs: 5,
            readyWaitTimeoutMs: 50,
        })
        await expect(service.getDatabase('pera.db')).rejects.toThrow(
            /offscreen database host/i,
        )
    })

    it('rejects within the deadline when the host accepts the ping but never responds', async () => {
        installScriptedHost(fake, { pingHangs: true })
        fake.messageListeners.add((message, _s, sendResponse) => {
            const msg = message as { scope?: string }
            if (msg?.scope !== DB_CONTROL_SCOPE) return undefined
            sendResponse({ ok: true })
            return undefined
        })
        const service = new ChromeDatabaseService({
            readyPollIntervalMs: 5,
            readyWaitTimeoutMs: 50,
        })
        const start = Date.now()
        await expect(service.getDatabase('pera.db')).rejects.toThrow(
            /offscreen database host/i,
        )
        // A hung ping must not stall past the configured deadline.
        expect(Date.now() - start).toBeLessThan(500)
    })

    it('unwraps a get row per drizzle sqlite-proxy semantics (rows IS the row, not an array of rows)', async () => {
        installScriptedHost(fake)
        const service = new ChromeDatabaseService()
        const db = await service.getDatabase('pera.db')
        const row = await db.get<[number, string]>(sql`SELECT 1, 'row'`)
        expect(row).toEqual([1, 'row'])
    })

    it('resolves get to undefined when the host reports no matching row', async () => {
        installScriptedHost(fake, {
            respond: () => ({ ok: true, rows: [] }),
        })
        const service = new ChromeDatabaseService()
        const db = await service.getDatabase('pera.db')
        const row = await db.get(sql`SELECT 1 WHERE 0`)
        expect(row).toBeUndefined()
    })

    it('does not retry a definitive exec-failed response (real SQL error surfaces immediately)', async () => {
        const { execCalls } = installScriptedHost(fake, {
            respond: () => ({
                ok: false,
                code: 'exec-failed',
                error: 'no such table: x',
            }),
        })
        const service = new ChromeDatabaseService()
        const db = await service.getDatabase('pera.db')
        let caught: (Error & { cause?: unknown }) | undefined
        try {
            await db.values(sql`SELECT * FROM x`)
        } catch (error) {
            caught = error as Error & { cause?: unknown }
        }
        // drizzle-orm wraps the callback's throw in its own "Failed query"
        // error and puts ours on .cause — assert the underlying cause so
        // this test fails if the real SQL error ever stops propagating.
        expect(caught).toBeDefined()
        expect((caught?.cause as Error)?.message).toMatch(/no such table/)
        expect(execCalls).toHaveLength(1)
    })

    it('retries once on a transport timeout (host still there but slow to answer)', async () => {
        let execCallCount = 0
        fake.messageListeners.add((message, _sender, sendResponse) => {
            const msg = message as DbMessage
            if (msg?.scope !== DB_SCOPE) return undefined
            if (msg.kind === 'ping') {
                sendResponse({ ok: true, ready: true })
                return undefined
            }
            if (msg.kind === 'exec') {
                execCallCount += 1
                if (execCallCount === 1) return true // never responds — simulates a wedged host
                sendResponse({ ok: true, rows: [[1, 'row']] })
                return undefined
            }
            return undefined
        })
        const service = new ChromeDatabaseService({
            execTimeoutMs: 20,
            readyPollIntervalMs: 5,
            readyWaitTimeoutMs: 500,
        })
        const db = await service.getDatabase('pera.db')
        const rows = await db.values(sql`SELECT 1, 'row'`)
        expect(rows).toEqual([[1, 'row']])
        expect(execCallCount).toBe(2)
    })

    it('marshals Uint8Array and bigint through the wire (encode before send, decode on the way back)', async () => {
        const bytesParam = new Uint8Array([1, 2, 3, 4])
        const bigintParam = 9_007_199_254_740_993n // beyond Number precision
        let capturedParams: unknown[] = []
        installScriptedHost(fake, {
            respond: msg => {
                capturedParams = msg.params
                // Echo the still-wire-encoded params back as the single
                // row, so a correct decode is the only way the assertions
                // below on the returned row can pass.
                return { ok: true, rows: [msg.params] }
            },
        })
        const service = new ChromeDatabaseService()
        const db = await service.getDatabase('pera.db')
        const row = await db.get<[Uint8Array, bigint]>(
            sql`SELECT ${bytesParam}, ${bigintParam}`,
        )

        // The host must receive encoded wire tags, not raw Uint8Array/bigint
        // — chrome.runtime.sendMessage JSON-serializes, which would
        // otherwise silently mangle both types.
        expect(capturedParams[0]).toEqual({ __pera_u8: expect.any(String) })
        expect(capturedParams[1]).toEqual({
            __pera_bigint: '9007199254740993',
        })

        // The caller must get real instances back, per row.
        expect(row?.[0]).toBeInstanceOf(Uint8Array)
        expect(row?.[0]).toEqual(bytesParam)
        expect(typeof row?.[1]).toBe('bigint')
        expect(row?.[1]).toBe(bigintParam)
    })
})
