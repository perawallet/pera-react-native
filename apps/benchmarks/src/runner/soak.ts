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

export type SoakOptions = {
    durationMs: number
    /** A reading is taken at the start, after every this many ticks, and at the end. */
    sampleEvery: number
    tick: () => Promise<void>
    sample: (atMs: number) => void
    now: () => number
}

/** Runs `tick` back to back for `durationMs`, sampling along the way; returns the tick count. */
export const runSoak = async ({
    durationMs,
    sampleEvery,
    tick,
    sample,
    now,
}: SoakOptions): Promise<number> => {
    const start = now()
    let ticks = 0
    sample(0)
    while (now() - start < durationMs) {
        await tick()
        ticks += 1
        if (ticks % sampleEvery === 0) sample(now() - start)
    }
    sample(now() - start)
    return ticks
}
