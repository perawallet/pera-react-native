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

export type DatabaseBindValue = string | number | null | boolean | Uint8Array

export interface Database {
    runAsync(sql: string, params?: DatabaseBindValue[]): Promise<void>
    getAllAsync<T>(sql: string, params?: DatabaseBindValue[]): Promise<T[]>
    getFirstAsync<T>(
        sql: string,
        params?: DatabaseBindValue[],
    ): Promise<T | null>
    withTransactionAsync(fn: () => Promise<void>): Promise<void>
}

export interface DatabaseDriver {
    readonly driver: unknown
}

export interface DatabaseService {
    open(name: string): Promise<DatabaseDriver>
    getDatabase(name: string): Promise<Database>
    close(name: string): Promise<void>
}
