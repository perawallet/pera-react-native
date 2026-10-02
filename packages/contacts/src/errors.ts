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

import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type { ContactRef } from './models'

/**
 * Thrown by `addContact` when the address is already in use in its family,
 * or by `editContact` when renaming into an address another contact holds in
 * that family. UI layers catch this and surface it as a form-level error.
 */
export class DuplicateAddressError extends Error {
    readonly family: ChainFamily
    readonly address: string

    constructor({ family, address }: ContactRef) {
        super(`A contact with address ${address} already exists`)
        this.name = 'DuplicateAddressError'
        this.family = family
        this.address = address
    }
}

/**
 * Thrown by `editContact` when no contact matches the ref.
 * Surfaces the case where the caller's `selectedContact` is stale (e.g.
 * deleted on another device) so the UI doesn't silently report success.
 */
export class ContactNotFoundError extends Error {
    readonly family: ChainFamily
    readonly address: string

    constructor({ family, address }: ContactRef) {
        super(`No contact found at address ${address}`)
        this.name = 'ContactNotFoundError'
        this.family = family
        this.address = address
    }
}
