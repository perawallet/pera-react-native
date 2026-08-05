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

export type OverflowRecord = {
    key: string
    kind: 'truncated' | 'wider-than-parent'
    text: string
}

// Module-level, not component state: PWText instances unmount between tour
// steps, but the drain in runTourStep needs to read whatever accumulated
// across the whole step regardless of which instances are still alive.
const overflows = new Map<string, OverflowRecord>()

export const recordOverflow = (record: OverflowRecord): void => {
    // A non-string child with no testID has nothing real to key on (PWText
    // falls back to '' in that case) — recording it would collapse every
    // such instance into one shared, unactionable entry instead of dropping
    // silently, which is what an unkeyable record should do.
    if (record.key === '') return
    overflows.set(`${record.key}:${record.kind}`, record)
}

export const drainOverflow = (): OverflowRecord[] => {
    const records = [...overflows.values()]
    overflows.clear()
    return records
}
