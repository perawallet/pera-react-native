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

/**
 * Dev-only API record/replay for the Screen Gallery. Patches `global.fetch`
 * directly rather than MSW (Hermes-safe — avoids MSW's `BroadcastChannel`).
 */

import { getProvider } from '@perawallet/wallet-extension-provider'
import { mockNotificationsResponse } from '@perawallet/wallet-core-dev-fixtures'

type DumpEntry = { status: number; body: string }
type Dump = Record<string, DumpEntry>

const DUMP_KEY = 'dev-api-response-dump'

let mode: 'off' | 'record' | 'replay' = 'off'
let dump: Dump = {}
let patched = false
let originalFetch: typeof fetch | null = null

const requestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input
    if (input instanceof URL) return input.href
    return input.url
}

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

// Authored edge-case overrides applied in replay regardless of the dump.
const overrideFor = (url: string): Response | null => {
    if (url.includes('/devices/') && url.includes('/notifications/')) {
        return jsonResponse(mockNotificationsResponse)
    }
    if (url.includes('/notification-status/')) {
        return jsonResponse({ has_new_notification: true })
    }
    return null
}

const persistDump = (): void => {
    try {
        void getProvider().keyValueStorage.setItem(
            DUMP_KEY,
            JSON.stringify(dump),
        )
    } catch {
        // best-effort persistence
    }
}

const loadDump = async (): Promise<void> => {
    try {
        const raw = await getProvider().keyValueStorage.getItem(DUMP_KEY)
        if (raw) dump = JSON.parse(raw) as Dump
    } catch {
        // best-effort load
    }
}

const ensurePatched = (): void => {
    if (patched) return
    patched = true
    originalFetch = global.fetch

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const realFetch = originalFetch as typeof fetch
        const url = requestUrl(input)

        if (mode === 'replay') {
            const override = overrideFor(url)
            if (override) return override
            const entry = dump[url]
            if (entry) return jsonResponse(entry.body, entry.status)
            return realFetch(input, init)
        }

        if (mode === 'record') {
            const response = await realFetch(input, init)
            try {
                const body = await response.clone().text()
                dump[url] = { status: response.status, body }
                persistDump()
            } catch {
                // skip non-text/streamed bodies
            }
            return response
        }

        return realFetch(input, init)
    }) as typeof fetch
}

/** Capture real responses (run on an online build). */
export const startApiRecording = (): void => {
    ensurePatched()
    mode = 'record'
}

/** Serve captured responses + authored overrides (offline-friendly). */
export const startApiReplay = async (): Promise<void> => {
    await loadDump()
    ensurePatched()
    mode = 'replay'
}
