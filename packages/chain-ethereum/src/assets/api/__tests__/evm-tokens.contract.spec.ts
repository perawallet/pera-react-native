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
import {
    expectEveryRowParses,
    readBackendRecording,
} from '../../../__tests__/backend-recordings'
import { whitelistPath } from '../endpoints'
import { whitelistItemSchema, whitelistResponseSchema } from '../schema'

const recording = readBackendRecording('evm-tokens')

describe('GET /api/v3/evm/{id}/tokens/ contract', () => {
    it('is the route the app calls', () => {
        expect(recording.request).toMatchObject({
            method: 'GET',
            path: whitelistPath(recording.request.pathParams?.chainId ?? -1),
        })
    })

    it('the recorded response parses', () => {
        const { results } = whitelistResponseSchema.parse(recording.response)

        expectEveryRowParses(results, whitelistItemSchema)
    })

    it('lists the native token', () => {
        const { results } = whitelistResponseSchema.parse(recording.response)

        expect(
            results.map(row => whitelistItemSchema.parse(row).type),
        ).toContain('native')
    })
})
