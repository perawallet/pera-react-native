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

/**
 * Max rows per multi-row INSERT/DELETE. Each statement is one round-trip
 * through the async sqlite-proxy bridge, so batching is far faster than
 * per-row writes; 200 keeps a wide row well under SQLite's bound-parameter
 * limit.
 */
export const DB_WRITE_CHUNK_SIZE = 200

/**
 * Runs `write` once per chunk of `rows`, sequentially. No transaction is
 * opened: each chunk commits on its own, so a caller needing atomicity across
 * chunks must wrap the call itself.
 */
export async function forEachWriteChunk<T>(
    rows: readonly T[],
    write: (chunk: T[]) => Promise<unknown>,
    chunkSize: number = DB_WRITE_CHUNK_SIZE,
): Promise<void> {
    for (let i = 0; i < rows.length; i += chunkSize) {
        await write(rows.slice(i, i + chunkSize))
    }
}
