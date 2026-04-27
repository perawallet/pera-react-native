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

/**
 * Thrown by `saveContact` when a contact with the same address already
 * exists (and is not the contact being updated). UI layers catch this and
 * surface it as a form-level error.
 */
export class DuplicateAddressError extends Error {
    readonly address: string

    constructor(address: string) {
        super(`A contact with address ${address} already exists`)
        this.name = 'DuplicateAddressError'
        this.address = address
    }
}
