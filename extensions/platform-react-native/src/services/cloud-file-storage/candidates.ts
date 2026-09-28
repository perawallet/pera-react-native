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

import {
    CloudFileNotFoundError,
    type ChooseCloudFile,
    type CloudFileStore,
    type ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'

// Sequential on purpose: a burst of parallel downloads against a cloud store is
// worse than ten small reads in a row.
const PROBE_LIMIT = 10

// A saved file is a few hundred bytes; the ceiling only keeps whatever else the
// user put in the folder out of a JS string.
const MAX_PROBE_BYTES = 64 * 1024

/** One entry's contents; `null` when unreadable or larger than `maxBytes`. */
type ReadEntry = (fileName: string, maxBytes: number) => Promise<string | null>

export type ResolvedCandidate = {
    fileName: string
    contents?: string
}

// Per-file access survives a rename, so a renamed file is still listed and only
// the name filter rejects it.
const probeContents = async (
    entries: string[],
    isCandidateContents: ((contents: string) => boolean) | undefined,
    readEntry: ReadEntry,
): Promise<ResolvedCandidate[]> => {
    if (!isCandidateContents) return []
    const found: ResolvedCandidate[] = []
    for (const fileName of entries.slice(0, PROBE_LIMIT)) {
        let contents: string | null
        try {
            contents = await readEntry(fileName, MAX_PROBE_BYTES)
        } catch {
            continue
        }
        if (contents !== null && isCandidateContents(contents)) {
            found.push({ fileName, contents })
        }
    }
    return found
}

const chooseFrom = async (
    candidates: ResolvedCandidate[],
    store: CloudFileStore,
    chooseFile: ChooseCloudFile,
): Promise<ResolvedCandidate | null> => {
    const [only, ...rest] = candidates
    if (!only) throw new CloudFileNotFoundError(store)
    if (rest.length === 0) return only
    const chosen = await chooseFile(candidates.map(({ fileName }) => fileName))
    return candidates.find(({ fileName }) => fileName === chosen) ?? null
}

/**
 * The single one of ours in the folder, or the one the user picks from several;
 * `null` when they back out. Carries the contents when the probe already read
 * them, so the caller can skip a second round trip.
 */
export const resolveCandidate = async (
    entries: string[],
    store: CloudFileStore,
    { isCandidate, isCandidateContents, chooseFile }: ReadCloudFileOptions,
    readEntry: ReadEntry,
): Promise<ResolvedCandidate | null> => {
    const named = entries.filter(isCandidate).map(fileName => ({ fileName }))
    const candidates =
        named.length > 0
            ? named
            : await probeContents(entries, isCandidateContents, readEntry)
    return chooseFrom(candidates, store, chooseFile)
}
