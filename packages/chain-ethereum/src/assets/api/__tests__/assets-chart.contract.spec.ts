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
import { CHART_PATH } from '../endpoints'
import { chartPointSchema, chartResponseSchema } from '../schema'

const recording = readBackendRecording('assets-chart')

describe('GET /api/v4/assets/chart/ contract', () => {
    it('is the route the app calls', () => {
        expect(recording.request).toMatchObject({
            method: 'GET',
            path: CHART_PATH,
        })
    })

    it('the recorded response parses', () => {
        const points = chartResponseSchema.parse(recording.response)

        expectEveryRowParses(points, chartPointSchema)
    })

    it('carries datetimes the app can turn into timestamps', () => {
        const points = chartResponseSchema.parse(recording.response)

        expect(
            points.filter(point => Number.isNaN(Date.parse(point.datetime))),
        ).toEqual([])
    })
})
