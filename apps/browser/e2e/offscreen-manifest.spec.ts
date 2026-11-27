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

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type CDPSession,
} from '@playwright/test'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

let context: BrowserContext

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
})

test.afterAll(async () => {
    await context.close()
})

// The offscreen document is not a Playwright page, so this evaluates in it
// over CDP: attach without flattening and exchange raw protocol messages.
const evaluateInOffscreen = async (
    cdp: CDPSession,
    expression: string,
): Promise<unknown> => {
    const { targetInfos } = await cdp.send('Target.getTargets')
    const offscreen = targetInfos.find(info =>
        info.url.endsWith('/offscreen.html'),
    )
    if (!offscreen) throw new Error('no offscreen document yet')
    const { sessionId } = await cdp.send('Target.attachToTarget', {
        targetId: offscreen.targetId,
        flatten: false,
    })
    try {
        const reply = new Promise<unknown>(resolve => {
            const onMessage = (event: {
                sessionId: string
                message: string
            }): void => {
                if (event.sessionId !== sessionId) return
                const message = JSON.parse(event.message) as {
                    id?: number
                    result?: { result?: { value?: unknown } }
                }
                if (message.id !== 1) return
                cdp.off('Target.receivedMessageFromTarget', onMessage)
                resolve(message.result?.result?.value)
            }
            cdp.on('Target.receivedMessageFromTarget', onMessage)
        })
        await cdp.send('Target.sendMessageToTarget', {
            sessionId,
            message: JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: { expression, returnByValue: true },
            }),
        })
        return await reply
    } finally {
        await cdp.send('Target.detachFromTarget', { sessionId })
    }
}

// Chrome gives offscreen documents no chrome.runtime.getManifest, and a
// production build's dApp requests read the manifest there.
test('the offscreen document reads the packaged manifest', async () => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    const { version } = JSON.parse(
        readFileSync(path.join(dist, 'manifest.json'), 'utf8'),
    ) as { version: string }
    const cdp = await context.newCDPSession(await context.newPage())

    await expect(async () => {
        // 'pera-db' wakes the offscreen document: DB_SCOPE in
        // extensions/platform-chrome/src/database/protocol.ts.
        await serviceWorker.evaluate(() =>
            chrome.runtime.sendMessage({ scope: 'pera-db', kind: 'ping' }),
        )
        const offscreenVersion = await evaluateInOffscreen(
            cdp,
            "typeof chrome.runtime.getManifest === 'function' ? chrome.runtime.getManifest().version : null",
        )
        expect(offscreenVersion).toBe(version)
    }).toPass({ timeout: 60_000 })
})
