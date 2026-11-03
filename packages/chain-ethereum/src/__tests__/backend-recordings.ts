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
import { z } from 'zod'

export type BackendRecordingName =
    | 'assets'
    | 'assets-chart'
    | 'evm-tokens'
    | 'evm-account-transactions'
    | 'evm-balance-history'
    | 'accounts-should-refresh'

export type BackendRecording = {
    request: {
        method: 'GET' | 'POST'
        path: string
        /** The path's variable segments, so a spec can rebuild it with the app's own path builder. */
        pathParams?: { chainId?: number; address?: string }
        params?: Record<string, string>
        body?: unknown
    }
    recordedFrom: string
    recordedAt: string
    response: unknown
}

const backendRecordingSchema = z.object({
    request: z.object({
        method: z.enum(['GET', 'POST']),
        path: z.string(),
        pathParams: z
            .object({
                chainId: z.number().int().optional(),
                address: z.string().optional(),
            })
            .optional(),
        params: z.record(z.string(), z.string()).optional(),
        body: z.unknown().optional(),
    }),
    recordedFrom: z.string(),
    recordedAt: z.iso.datetime(),
    response: z.unknown(),
})

/** A backend response recorded by tools/dev/record-backend-responses.mjs. */
export const readBackendRecording = (
    name: BackendRecordingName,
): BackendRecording =>
    backendRecordingSchema.parse(
        JSON.parse(
            readFileSync(
                new URL(`./backend-recordings/${name}.json`, import.meta.url),
                'utf8',
            ),
        ),
    )

/**
 * Production parses rows with `safeParse` and drops the ones it can't read, so
 * a backend change there only shows as missing data. Here it throws. An empty
 * list throws too: it says nothing about the row shape.
 */
export const expectEveryRowParses = (
    rows: readonly unknown[],
    schema: z.ZodType,
): void => {
    if (rows.length === 0) {
        throw new Error('The recording has no rows to check')
    }
    rows.forEach((row, index) => {
        const result = schema.safeParse(row)
        if (!result.success) {
            throw new Error(
                `Row ${index} no longer parses:\n${z.prettifyError(result.error)}`,
            )
        }
    })
}
