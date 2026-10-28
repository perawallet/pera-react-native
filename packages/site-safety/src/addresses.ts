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

// Only shapes some chain could sign for; anything else can never match a request.
const EVM_ADDRESS = /^0x[0-9a-f]{40}$/
const ALGORAND_ADDRESS = /^[a-z2-7]{58}$/

/**
 * The one form an address is stored and looked up in. Lowercase is canonical
 * for both families: EVM hex ignores case, and Algorand base32 is single-case.
 */
export const toListedAddressKey = (address: string): string =>
    address.trim().toLowerCase()

/** Valid, deduplicated keys; anything no chain could sign for is dropped. */
export const normalizeListedAddresses = (
    entries: readonly string[],
): string[] => {
    const keys = new Set<string>()
    for (const entry of entries) {
        const key = toListedAddressKey(entry)
        if (EVM_ADDRESS.test(key) || ALGORAND_ADDRESS.test(key)) keys.add(key)
    }
    return [...keys]
}
