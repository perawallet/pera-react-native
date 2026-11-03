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
import { z } from 'zod'
import {
    expectEveryRowParses,
    readBackendRecording,
} from '../../../__tests__/backend-recordings'
import { ASSETS_PATH } from '../endpoints'
import { assetItemSchema, assetsResponseSchema } from '../schema'

const recording = readBackendRecording('assets')

describe('POST /api/v4/assets/ contract', () => {
    it('is the route the app calls', () => {
        expect(recording.request).toMatchObject({
            method: 'POST',
            path: ASSETS_PATH,
        })
    })

    it('the recorded response parses', () => {
        const { results } = assetsResponseSchema.parse(recording.response)

        expectEveryRowParses(results, assetItemSchema)
    })

    it('answers one row per requested id, in request order', () => {
        const { ids } = z
            .object({ ids: z.array(z.string()) })
            .parse(recording.request.body)

        const { results } = assetsResponseSchema.parse(recording.response)

        // The app sends lowercase ids and compares lowercase, as here.
        expect(results.map(row => row.asset_id.toLowerCase())).toEqual(
            ids.map(id => id.toLowerCase()),
        )
    })
})
