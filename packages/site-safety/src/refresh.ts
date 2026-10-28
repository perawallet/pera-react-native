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
    deleteOtherGenerations,
    writePhishingListGeneration,
} from './db/repository'
import { nextPhishingListGeneration } from './generation'
import type {
    PhishingListRefreshOutcome,
    PhishingListSource,
    PhishingListSourceId,
} from './models'
import { PHISHING_LIST_SOURCES } from './sources'
import { usePhishingListStore } from './store/store'

/** A source whose last successful check is older than this is due. */
export const PHISHING_LIST_REFRESH_AGE_MS = 12 * 60 * 60 * 1000

const DEFAULT_TIMEOUT_MS = 30_000

export type RefreshPhishingListsOptions = {
    fetch?: typeof fetch
    now?: () => number
    timeoutMs?: number
}

type SourceRefreshContext = {
    fetchImpl: typeof fetch
    now: () => number
    timeoutMs: number
}

const download = async (
    source: PhishingListSource,
    { fetchImpl, timeoutMs }: SourceRefreshContext,
): Promise<Response> => {
    const etag = usePhishingListStore.getState().sources[source.id]?.etag
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        // Browsers hide GitHub's ETag from CORS reads, so an etag is only ever
        // stored on mobile; a conditional request from the extension would need
        // a preflight that GitHub rejects.
        return await fetchImpl(source.url, {
            headers: etag ? { 'If-None-Match': etag } : undefined,
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timer)
    }
}

const refreshSource = async (
    source: PhishingListSource,
    context: SourceRefreshContext,
): Promise<PhishingListRefreshOutcome> => {
    const store = usePhishingListStore.getState()

    let response: Response
    let raw: unknown
    try {
        response = await download(source, context)
        if (response.status === 304) {
            store.markRefreshed(source.id, context.now())
            return 'unchanged'
        }
        if (!response.ok) {
            logger.warn('[site-safety] phishing list download failed', {
                source: source.id,
                status: response.status,
            })
            return 'failed'
        }
        raw = await response.json().catch(() => undefined)
    } catch (error) {
        logger.warn('[site-safety] phishing list download failed', {
            source: source.id,
            error,
        })
        return 'failed'
    }

    const entries = raw === undefined ? undefined : source.parse(raw)
    if (!entries || entries.deny.length < source.minimumDenyEntries) {
        logger.warn('[site-safety] phishing list download was malformed', {
            source: source.id,
            denyEntries: entries?.deny.length,
        })
        return 'malformed'
    }

    const generation = nextPhishingListGeneration()
    try {
        await writePhishingListGeneration({
            source: source.id,
            generation,
            entries,
        })
    } catch (error) {
        // The half-written generation is never activated; the next good
        // refresh deletes it with the rest.
        logger.warn('[site-safety] writing a phishing list failed', {
            source: source.id,
            error,
        })
        return 'failed'
    }

    store.activateGeneration(source.id, {
        generation,
        etag: response.headers.get('etag') ?? undefined,
        refreshedAt: context.now(),
        origin: 'downloaded',
    })
    await deleteOtherGenerations({
        source: source.id,
        keepGeneration: generation,
    }).catch(error => {
        logger.warn('[site-safety] pruning old phishing lists failed', {
            source: source.id,
            error,
        })
    })
    return 'updated'
}

/**
 * Downloads every source and swaps in each one that validates. A source that
 * fails, returns `304` or looks truncated keeps its current copy.
 */
export const refreshPhishingLists = async (
    options: RefreshPhishingListsOptions = {},
): Promise<Record<PhishingListSourceId, PhishingListRefreshOutcome>> => {
    const context: SourceRefreshContext = {
        fetchImpl: options.fetch ?? ((input, init) => fetch(input, init)),
        now: options.now ?? Date.now,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
    const outcomes = await Promise.all(
        PHISHING_LIST_SOURCES.map(
            async source =>
                [source.id, await refreshSource(source, context)] as const,
        ),
    )
    return Object.fromEntries(outcomes) as Record<
        PhishingListSourceId,
        PhishingListRefreshOutcome
    >
}
