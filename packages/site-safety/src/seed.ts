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

import { logger } from '@perawallet/wallet-core-shared'
import {
    countGenerationRows,
    deleteOtherGenerations,
    writePhishingListGeneration,
} from './db/repository'
import { nextPhishingListGeneration } from './generation'
import type { PhishingListSnapshot, PhishingListSourceId } from './models'
import { PHISHING_LIST_SOURCES } from './sources'
import { usePhishingListStore } from './store/store'

export type EnsurePhishingListsSeededOptions = {
    loadSnapshot?: () => Promise<PhishingListSnapshot>
}

// Loaded on demand: the snapshot is megabytes, and only a fresh install or a
// wiped database ever reads it.
export const loadBundledPhishingLists =
    async (): Promise<PhishingListSnapshot> => {
        const module = await import('./bundled/phishing-lists.json')
        return (module.default ?? module) as PhishingListSnapshot
    }

const splitLines = (value: string): string[] =>
    value ? value.split('\n').filter(line => line.length > 0) : []

// Generations already confirmed to hold rows, so the hot path skips the count.
const confirmedGenerations = new Map<PhishingListSourceId, number>()

const needsSeeding = async (source: PhishingListSourceId): Promise<boolean> => {
    const state = usePhishingListStore.getState().sources[source]
    if (!state) return true
    if (confirmedGenerations.get(source) === state.generation) return false
    const rows = await countGenerationRows({
        source,
        generation: state.generation,
    })
    if (rows === 0) return true
    confirmedGenerations.set(source, state.generation)
    return false
}

const seedMissingSources = async (
    loadSnapshot: () => Promise<PhishingListSnapshot>,
): Promise<void> => {
    const missing: PhishingListSourceId[] = []
    for (const { id } of PHISHING_LIST_SOURCES) {
        if (await needsSeeding(id)) missing.push(id)
    }
    if (missing.length === 0) return

    const snapshot = await loadSnapshot()
    for (const source of missing) {
        const lists = snapshot.sources[source]
        const generation = nextPhishingListGeneration()
        await writePhishingListGeneration({
            source,
            generation,
            entries: {
                deny: splitLines(lists.deny),
                allow: splitLines(lists.allow),
                impersonationTargets: splitLines(lists.impersonationTargets),
            },
        })
        // refreshedAt 0 makes the first online check download a fresh copy.
        usePhishingListStore.getState().activateGeneration(source, {
            generation,
            refreshedAt: 0,
            origin: 'bundled',
        })
        confirmedGenerations.set(source, generation)
        await deleteOtherGenerations({ source, keepGeneration: generation })
        logger.debug('[site-safety] seeded bundled phishing list', { source })
    }
}

let inFlight: Promise<void> | null = null

/**
 * Writes the bundled lists for any source with no usable copy: a fresh install,
 * a wiped database, or a first launch offline. Safe to call on every check.
 */
export const ensurePhishingListsSeeded = (
    options: EnsurePhishingListsSeededOptions = {},
): Promise<void> => {
    inFlight ??= seedMissingSources(
        options.loadSnapshot ?? loadBundledPhishingLists,
    ).finally(() => {
        inFlight = null
    })
    return inFlight
}

/**
 * Settles once a seed started in this context has finished. Readers wait on
 * this instead of seeding: in the extension several contexts share one
 * database, and only the context running the refresh may write it.
 */
export const whenPhishingListsSeeded = (): Promise<void> =>
    inFlight ?? Promise.resolve()
