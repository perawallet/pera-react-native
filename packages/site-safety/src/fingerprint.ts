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

import type { PhishingListEntries } from './models'

/**
 * A 53-bit hash (cyrb53) of the entries in list order, enough to tell whether a
 * download differs from the copy already stored. Not for security: a list
 * that hashes the same is simply not rewritten.
 */
export const fingerprintPhishingListEntries = (
    entries: PhishingListEntries,
): string => {
    let h1 = 0xde_ad_be_ef
    let h2 = 0x41_c6_ce_57
    const mix = (code: number): void => {
        h1 = Math.imul(h1 ^ code, 2_654_435_761)
        h2 = Math.imul(h2 ^ code, 1_597_334_677)
    }
    for (const list of [
        entries.deny,
        entries.allow,
        entries.impersonationTargets,
    ]) {
        for (const entry of list) {
            for (let i = 0; i < entry.length; i++) mix(entry.charCodeAt(i))
            mix(10)
        }
        mix(0)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507)
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507)
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909)
    return (4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0)).toString(36)
}
