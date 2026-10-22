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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChromeMonotonicClockService } from '../services/monotonic-clock'

describe('ChromeMonotonicClockService', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reads performance.now() keyed by the context time origin', () => {
        vi.spyOn(performance, 'now').mockReturnValue(812.25)

        const reading = new ChromeMonotonicClockService().now()

        expect(reading).toEqual({
            bootId: String(performance.timeOrigin),
            elapsedMs: 812.25,
        })
    })
})
