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

import { sha256 } from '@noble/hashes/sha2.js'
import { AutoDrawTealUnverifiedError } from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import { AUTODRAW_TEAL_TEMPLATE } from './autodraw-teal'

/**
 * Lowercase hex SHA-256 of the template's UTF-8 bytes. `pnpm
 * check:autodraw-hash --print` computes the same value at build time; the two
 * must agree byte for byte or the pin is meaningless.
 */
export const computeAutoDrawTemplateHash = (): string =>
    bytesToHex(sha256(new TextEncoder().encode(AUTODRAW_TEAL_TEMPLATE)))

/**
 * Fails closed unless the bundled template hashes to the pin injected from
 * Bitrise (`CARD_AUTODRAW_TEMPLATE_HASH`). One value for every network: the
 * template is hashed before app ids are rendered in, unlike the compiled
 * program pin. Runs in every environment; staging builds sign real keys too.
 */
export const verifyAutoDrawTealTemplate = (
    expected: string = config.cardAutoDrawTemplateHash,
): void => {
    // `?? ''`: test doubles of the config module may omit the key.
    const pinned = (expected ?? '').trim().toLowerCase()
    if (!pinned || pinned !== computeAutoDrawTemplateHash()) {
        throw new AutoDrawTealUnverifiedError()
    }
}
