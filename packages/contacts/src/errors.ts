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

import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'

/**
 * Thrown by `editContact` when no contact has the id.
 * Surfaces the case where the caller's `selectedContact` is stale (e.g.
 * deleted on another device) so the UI doesn't silently report success.
 */
export class ContactNotFoundError extends AppError {
    readonly id: string

    constructor(id: string) {
        super(`No contact found with id ${id}`, {
            category: ErrorCategory.STORAGE,
        })
        this.name = 'ContactNotFoundError'
        this.id = id
    }
}
