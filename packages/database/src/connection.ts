/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

export type DrizzleDatabase = BaseSQLiteDatabase<'sync', unknown>

let instance: DrizzleDatabase | null = null

export const setDrizzle = (db: DrizzleDatabase): void => {
    instance = db
}

export const getDrizzle = (): DrizzleDatabase => {
    if (instance === null) {
        throw new Error(
            'Database not initialized. Call setDrizzle() during app bootstrap.',
        )
    }

    return instance
}

export const resetDrizzle = (): void => {
    instance = null
}
