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

import type { z } from 'zod'

export class BackupResponseParseError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'BackupResponseParseError'
    }
}

export const parseBackupResponse = <T>(
    schema: z.ZodType<T, unknown>,
    value: unknown,
    kind: string,
): T => {
    const result = schema.safeParse(value)
    if (!result.success) {
        const [issue] = result.error.issues
        const path = issue?.path.join('.')
        throw new BackupResponseParseError(
            `Invalid ${kind} response${path ? ` at ${path}` : ''}: ${issue?.message ?? 'unknown error'}`,
        )
    }
    return result.data
}
