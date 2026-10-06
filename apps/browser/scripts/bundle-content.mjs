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

// viem's BaseError embeds `viem@<version>` in every message, and a string
// literal survives minification.
export const VIEM_MARKER = 'viem@'

/**
 * Throws when a bundle built for a CHAINS that omits ethereum still carries viem.
 *
 * @param {string} code
 * @param {string} surface
 */
export const assertNoViem = (code, surface) => {
    if (!code.includes(VIEM_MARKER)) return
    throw new Error(
        `${surface} contains viem but CHAINS does not list ethereum: ` +
            'chain-ethereum got past the Metro chain gate ' +
            '(apps/mobile/metro-build-gates.js)',
    )
}
