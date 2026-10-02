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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    createChromeFake,
    type ChromeFake,
} from '@perawallet/wallet-extension-platform-chrome/test-utils'
import {
    TAB_RESUME_DONE_SCOPE,
    TAB_RESUME_RESULT_SESSION_KEY,
    TAB_RESUME_SESSION_KEY,
    finishTabResume,
    isTabResumeDoneMessage,
    putTabResumeIntent,
    takeTabResumeIntent,
    takeTabResumeResult,
} from '../tab-resume'

describe('tab resume intent', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('hands an intent from one page to the next through session storage', async () => {
        await putTabResumeIntent({ flow: 'swap' })

        expect(fake.sessionData.get(TAB_RESUME_SESSION_KEY)).toEqual({
            flow: 'swap',
        })
        expect(await takeTabResumeIntent()).toEqual({ flow: 'swap' })
    })

    it('is read once, so reloading the tab does not resume again', async () => {
        await putTabResumeIntent({ flow: 'send' })

        await takeTabResumeIntent()

        expect(await takeTabResumeIntent()).toBeNull()
    })

    it('stores the popup toast before asking the worker to close the tab', async () => {
        const received: { message: unknown; hasResult: boolean }[] = []
        fake.chrome.runtime.onMessage.addListener(
            (message, _sender, sendResponse) => {
                received.push({
                    message,
                    hasResult: fake.sessionData.has(
                        TAB_RESUME_RESULT_SESSION_KEY,
                    ),
                })
                sendResponse({ ok: true })
                return false
            },
        )

        await finishTabResume({ title: 'Swap Complete', body: 'done' })

        expect(received).toEqual([
            { message: { scope: TAB_RESUME_DONE_SCOPE }, hasResult: true },
        ])
        expect(await takeTabResumeResult()).toEqual({
            title: 'Swap Complete',
            body: 'done',
            createdAt: expect.any(Number),
        })
        expect(await takeTabResumeResult()).toBeNull()
    })

    it('recognises only its own done message', () => {
        expect(isTabResumeDoneMessage({ scope: TAB_RESUME_DONE_SCOPE })).toBe(
            true,
        )
        expect(isTabResumeDoneMessage({ scope: 'other' })).toBe(false)
        expect(isTabResumeDoneMessage(null)).toBe(false)
    })
})
