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

import type {
    DatabaseService,
    DatabaseDriver,
    DrizzleDatabase,
} from '../database'

export class MemoryDatabaseService implements DatabaseService {
    async open(_name: string): Promise<DatabaseDriver> {
        return { driver: null }
    }

    async getDatabase(_name: string): Promise<DrizzleDatabase> {
        throw new Error('MemoryDatabaseService.getDatabase is not implemented')
    }

    async close(_name: string): Promise<void> {}
}
