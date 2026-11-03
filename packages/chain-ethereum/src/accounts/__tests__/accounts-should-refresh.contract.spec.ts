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

import { describe, expect, it } from 'vitest'
import { readBackendRecording } from '../../__tests__/backend-recordings'
import { SHOULD_REFRESH_PATH, shouldRefreshResponseSchema } from '../endpoints'

const recording = readBackendRecording('accounts-should-refresh')

describe('POST /api/v4/accounts/should-refresh/ contract', () => {
    it('is the route the app calls', () => {
        expect(recording.request).toMatchObject({
            method: 'POST',
            path: SHOULD_REFRESH_PATH,
        })
    })

    it('the recorded response parses', () => {
        expect(() =>
            shouldRefreshResponseSchema.parse(recording.response),
        ).not.toThrow()
    })
})
