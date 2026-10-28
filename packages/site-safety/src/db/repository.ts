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

import { and, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import {
    forEachWriteChunk,
    getDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import type {
    ActiveGenerations,
    PhishingListEntries,
    PhishingListEntryKind,
    PhishingListSourceId,
} from '../models'
import { PhishingListDomainsSchema } from './schema'

// Four bound parameters per row keeps a chunk well under SQLite's limit.
const WRITE_CHUNK_SIZE = 200

const activeGenerationFilter = (
    generations: ActiveGenerations,
): SQL | undefined => {
    const clauses = Object.entries(generations).flatMap(
        ([source, generation]) =>
            generation === undefined
                ? []
                : [
                      and(
                          eq(
                              PhishingListDomainsSchema.source,
                              source as PhishingListSourceId,
                          ),
                          eq(PhishingListDomainsSchema.generation, generation),
                      ),
                  ],
    )
    return clauses.length > 0 ? or(...clauses) : undefined
}

type WritePhishingListGenerationParams = {
    db?: Database
    source: PhishingListSourceId
    generation: number
    entries: PhishingListEntries
}

/** Not atomic across chunks: write to an inactive generation, then activate it. */
export const writePhishingListGeneration = async ({
    db = getDatabase(),
    source,
    generation,
    entries,
}: WritePhishingListGenerationParams): Promise<void> => {
    const rows = (
        [
            ['deny', entries.deny],
            ['allow', entries.allow],
            ['impersonation-target', entries.impersonationTargets],
        ] as const satisfies readonly (readonly [
            PhishingListEntryKind,
            string[],
        ])[]
    ).flatMap(([kind, domains]) =>
        domains.map(domain => ({ source, generation, kind, domain })),
    )

    await forEachWriteChunk(
        rows,
        async chunk => {
            await db
                .insert(PhishingListDomainsSchema)
                .values(chunk)
                .onConflictDoNothing()
                .run()
        },
        WRITE_CHUNK_SIZE,
    )
}

type FindListedDomainsParams = {
    db?: Database
    generations: ActiveGenerations
    domains: readonly string[]
}

export const findListedDomains = async ({
    db = getDatabase(),
    generations,
    domains,
}: FindListedDomainsParams): Promise<{
    denied: string[]
    allowed: string[]
}> => {
    const active = activeGenerationFilter(generations)
    if (!active || domains.length === 0) return { denied: [], allowed: [] }

    const rows = await db
        .select({
            kind: PhishingListDomainsSchema.kind,
            domain: PhishingListDomainsSchema.domain,
        })
        .from(PhishingListDomainsSchema)
        .where(
            and(
                inArray(PhishingListDomainsSchema.domain, [...domains]),
                inArray(PhishingListDomainsSchema.kind, ['deny', 'allow']),
                active,
            ),
        )

    return {
        denied: rows.filter(row => row.kind === 'deny').map(row => row.domain),
        allowed: rows
            .filter(row => row.kind === 'allow')
            .map(row => row.domain),
    }
}

type ListKindParams = {
    db?: Database
    generations: ActiveGenerations
}

const findDomainsOfKind = async (
    kind: PhishingListEntryKind,
    { db = getDatabase(), generations }: ListKindParams,
): Promise<string[]> => {
    const active = activeGenerationFilter(generations)
    if (!active) return []
    const rows = await db
        .selectDistinct({ domain: PhishingListDomainsSchema.domain })
        .from(PhishingListDomainsSchema)
        .where(and(eq(PhishingListDomainsSchema.kind, kind), active))
    return rows.map(row => row.domain)
}

export const findImpersonationTargetDomains = (
    params: ListKindParams,
): Promise<string[]> => findDomainsOfKind('impersonation-target', params)

/** Every allow entry, for the look-alike exemptions. A few dozen rows. */
export const findAllowedDomains = (params: ListKindParams): Promise<string[]> =>
    findDomainsOfKind('allow', params)

type GenerationParams = {
    db?: Database
    source: PhishingListSourceId
    generation: number
}

export const countGenerationRows = async ({
    db = getDatabase(),
    source,
    generation,
}: GenerationParams): Promise<number> => {
    const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(PhishingListDomainsSchema)
        .where(
            and(
                eq(PhishingListDomainsSchema.source, source),
                eq(PhishingListDomainsSchema.generation, generation),
            ),
        )
    return Number(row?.count ?? 0)
}

export const deleteOtherGenerations = async ({
    db = getDatabase(),
    source,
    keepGeneration,
}: {
    db?: Database
    source: PhishingListSourceId
    keepGeneration: number
}): Promise<void> => {
    await db
        .delete(PhishingListDomainsSchema)
        .where(
            and(
                eq(PhishingListDomainsSchema.source, source),
                ne(PhishingListDomainsSchema.generation, keepGeneration),
            ),
        )
        .run()
}
