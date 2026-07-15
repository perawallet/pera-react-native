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

// Rejection-sampled uniform integer in [0, max) backed by the platform CSRNG.
// We never want `Math.random()` near wallet material; this helper is the one
// place the KMS pulls randomness for non-key-material sampling (e.g. picking
// mnemonic-word indices for a verification prompt).
export const uniformIntBelow = (max: number): number => {
    if (max <= 0) return 0
    const limit = Math.floor(0x1_00_00_00_00 / max) * max
    const buf = new Uint32Array(1)
    let value: number
    do {
        crypto.getRandomValues(buf)
        value = buf[0]
    } while (value >= limit)
    return value % max
}

/**
 * Returns `count` distinct integers in [0, poolSize). When `count >= poolSize`
 * the result covers the whole range. Caller gets a shuffled sample — indices
 * are not returned sorted.
 */
export const pickDistinctIndexes = (
    count: number,
    poolSize: number,
): number[] => {
    const effective = Math.min(Math.max(count, 0), poolSize)
    const pool = Array.from({ length: poolSize }, (_, i) => i)
    for (let i = pool.length - 1; i > 0; i--) {
        const j = uniformIntBelow(i + 1)
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, effective)
}
