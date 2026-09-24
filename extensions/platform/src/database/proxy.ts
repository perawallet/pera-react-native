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

import type { AsyncRemoteCallback } from 'drizzle-orm/sqlite-proxy'

export type DatabaseExecMethod = 'run' | 'all' | 'values' | 'get'

/**
 * A platform's raw SQL executor. Resolves every result row as an array of
 * column values in SELECT order (never keyed objects), and `[]` for `run`.
 */
export type DatabaseExec = (
    sql: string,
    params: unknown[],
    method: DatabaseExecMethod,
) => Promise<unknown[][]>

/**
 * Adapts a platform executor to drizzle's sqlite-proxy callback, so every
 * driver hands drizzle the same per-method result shape.
 */
export const createDrizzleProxyCallback =
    (exec: DatabaseExec): AsyncRemoteCallback =>
    async (sql, params, method) => {
        const rows = await exec(sql, params, method)
        // For 'get', drizzle's sqlite-proxy session expects `rows` to already
        // BE the single row. Passing the array through would make db.get()
        // return `[[...]]`, and never undefined for no match: its falsy
        // check can't see through a truthy `[]`. `rows[0]` is exactly
        // `undefined` when nothing matched. The cast bridges drizzle's
        // `rows: any[]`, which doesn't model this get-vs-all split.
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        return { rows: (method === 'get' ? rows[0] : rows) as any[] }
    }
