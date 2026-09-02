/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-unused-style-keys.ts'
const fixtures = (dir: string): string =>
    `lanekeep/__tests__/fixtures/${dir}/**/*.{ts,tsx}`

describe('pera/no-unused-style-keys', () => {
    it('reports only the key no consumer references', async () => {
        const found = await runRule(RULE, fixtures('unused-keys'))

        // `used` via member access, `alsoUsed` via plain destructuring, and
        // `renamed` via a renamed binding are all references.
        expect(locations(found)).toEqual(['styles.ts:7'])
        expect(found[0]?.message).toContain('neverUsed')
    })

    it('counts a key read through the agnostic import as used in the .web sibling', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-web'))

        // `shared` is declared in both files and read through `./platform-styles`,
        // which the bundler resolves to either one.
        expect(locations(found)).toEqual([
            'platform-styles.ts:5',
            'platform-styles.web.ts:5',
        ])
    })

    it('follows a hook imported under a renamed binding', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-alias'))

        expect(locations(found)).toEqual(['alias-styles.ts:5'])
        expect(found[0]?.message).toContain('aliasUnused')
    })

    it('follows a consumer that sits at a different directory depth', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-depth'))

        expect(locations(found)).toEqual(['deep-styles.ts:5'])
        expect(found[0]?.message).toContain('deepUnused')
    })

    it('reports nothing once the whole styles object escapes', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-escape'))

        // Naming the object without a key puts every key beyond reach, so
        // reporting one here would be advice to delete code that is in use.
        expect(locations(found)).toEqual([])
    })

    it('never reports a hook the file does not export', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-local'))

        // Its consumers cannot be enumerated from imports, so its keys are
        // unknowable rather than unused.
        expect(locations(found)).toEqual([])
    })

    it('reports nothing once the styles object escapes as object shorthand', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-shorthand'))

        // `{ styles }` parses the name as a shorthand property, not an
        // identifier, so it needs its own case: the escape fixture's forms are
        // both plain identifiers and structurally cannot reach this.
        expect(locations(found)).toEqual([])
    })

    it('reports nothing for a platform-suffixed file with no plain sibling', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-orphan'))

        // `./orphan-styles` matches no candidate on disk, yet the bundler
        // resolves it to the `.web` file, whose keys are therefore in use.
        expect(locations(found)).toEqual([])
    })

    it('reports nothing for a hook an unresolvable import names', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-opaque'))

        // An aliased specifier hides the consumer, so its keys are unknowable.
        expect(locations(found)).toEqual([])
    })

    it('counts a use of an exported hook in its own file', async () => {
        const found = await runRule(RULE, fixtures('unused-keys-samefile'))

        expect(locations(found)).toEqual(['SameFile.tsx:5'])
        expect(found[0]?.message).toContain('selfUnused')
    })
})
