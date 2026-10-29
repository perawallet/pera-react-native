/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    parseTypedJson,
    stringifyTypedJson,
} from '../../packages/shared/src/utils/json'
import { UNTAGGED_TYPES } from '../rules/persisted-query-serializable.js'
import { REPO_ROOT, locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/persisted-query-serializable.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/persisted-query/**/*.ts'

const BAD_LINES = [
    'persisted-policy.ts:5',
    'persisted-queries-unresolved.bad.ts:9',
    'persisted-queries-unresolved.bad.ts:15',
    'persisted-queries-unresolved.bad.ts:21',
    'persisted-queries-unresolved.bad.ts:27',
    'persisted-queries.bad.ts:21',
    'persisted-queries.bad.ts:27',
    'persisted-queries.bad.ts:33',
    'persisted-queries.bad.ts:39',
    'persisted-queries.bad.ts:45',
    'persisted-queries.bad.ts:51',
    'persisted-queries.bad.ts:57',
    'persisted-queries.bad.ts:63',
    'persisted-queries.bad.ts:69',
    'persisted-queries.bad.ts:75',
    'persisted-queries.bad.ts:82',
    'persisted-queries.bad.ts:89',
    'persisted-queries.bad.ts:95',
    'persisted-queries.bad.ts:101',
]

const messageAt = async (
    line: number,
    file = 'persisted-queries.bad.ts',
): Promise<string | undefined> => {
    const found = await runRule(RULE, FIXTURES)
    return found.find(v => v.file.endsWith(file) && v.line === line)?.message
}

describe('pera/persisted-query-serializable', () => {
    it('reports each persisted queryFn that reaches an untagged type, hides its payload or declares none', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found)).toEqual(BAD_LINES)
    })

    it('names the untagged type and the declarations it was reached through', async () => {
        expect(await messageAt(27)).toBe(
            'persisted query "kept/outer" caches Date (via Outer → WithDate), which the cache serializer does not round-trip',
        )
        expect(await messageAt(45)).toBe(
            'persisted query "kept/dated-schema" caches Date (via Dated → datedSchema), which the cache serializer does not round-trip',
        )
    })

    it('asks for a return type on an unannotated or opaque queryFn', async () => {
        expect(await messageAt(57)).toBe(
            'persisted query "kept/unannotated" needs an explicit queryFn return type so its payload can be checked',
        )
        expect(await messageAt(63)).toBe(
            'persisted query "kept/opaque" declares its payload as unknown; name the payload type',
        )
    })

    it('checks every arm of a conditional key, a spread key and a qualified type reference', async () => {
        const file = 'persisted-queries-unresolved.bad.ts'

        expect(await messageAt(9, file)).toBe(
            'persisted query "kept/dated" caches Date (via WithDate), which the cache serializer does not round-trip',
        )
        expect(await messageAt(15, file)).toBe(
            'persisted query "kept/spread" caches Date (via WithDate), which the cache serializer does not round-trip',
        )
        expect(await messageAt(27, file)).toBe(
            'persisted query "kept/qualified" caches Date (via WithDate), which the cache serializer does not round-trip',
        )
    })

    it('treats unknown or any anywhere in the payload as opaque', async () => {
        expect(await messageAt(21, 'persisted-queries-unresolved.bad.ts')).toBe(
            'persisted query "kept/opaque-array" declares its payload as unknown[]; name the payload type',
        )
    })

    it('reports a persist entry that no query key reaches', async () => {
        expect(await messageAt(5, 'persisted-policy.ts')).toBe(
            'QUERY_PREFIX_POLICY persists "ghost/entry" but no query key resolves to it; the entry is stale or its key shape changed',
        )
    })

    it('leaves the allowed shapes alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('persisted-queries.good.ts')),
        ).toEqual([])
    })

    // UNTAGGED_TYPES mirrors stringifyTypedJson: when the serializer starts
    // tagging one of them it must come off the list.
    it.each([
        ['Date', () => new Date(0)],
        ['Set', () => new Set([1])],
        ['ReadonlySet', () => new Set([1]) as ReadonlySet<number>],
    ])('the serializer does not round-trip %s', (name, sample) => {
        expect(UNTAGGED_TYPES).toContain(name)
        const value = sample()

        const restored = parseTypedJson(stringifyTypedJson({ value })) as {
            value: unknown
        }

        expect(restored.value).not.toBeInstanceOf(value.constructor)
    })

    it('reads the policy from the table the persistence provider still declares', () => {
        const source = readFileSync(
            join(REPO_ROOT, 'apps/mobile/src/providers/query-persistence.ts'),
            'utf8',
        )

        expect(source).toMatch(/export const QUERY_PREFIX_POLICY\b[^=]*=\s*\{/)
    })
})
