/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-deep-module-imports.ts'
const FIXTURES = 'lanekeep/__tests__/fixtures/apps/**/module-imports.*.ts'

const inFile = (
    found: Awaited<ReturnType<typeof runRule>>,
    name: string,
): string[] => locations(found.filter(v => v.file.endsWith(name)))

describe('pera/no-deep-module-imports', () => {
    it('reports every form of a deep import from another module — static, type-only, relative, re-export and deferred', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'module-imports.bad.ts')).toEqual([
            'module-imports.bad.ts:6',
            'module-imports.bad.ts:7',
            'module-imports.bad.ts:8',
            'module-imports.bad.ts:9',
            'module-imports.bad.ts:10',
            'module-imports.bad.ts:12',
            'module-imports.bad.ts:14',
        ])
    })

    it('says why a web entry is rejected outside a .web file', async () => {
        const found = await runRule(RULE, FIXTURES)

        const web = found.find(
            v => v.file.endsWith('module-imports.bad.ts') && v.line === 10,
        )
        expect(web?.message).toContain('web-only')
    })

    it('allows public entries, documented extra entries and a module’s own internals', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'module-imports.good.ts')).toEqual([])
        expect(inFile(found, 'module-imports.web.ts')).toEqual([])
    })

    it('applies to app files outside modules/ too', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'module-imports.routes.ts')).toEqual([
            'module-imports.routes.ts:7',
        ])
    })

    it('allow-lists the developer gallery, and the locale tour only for the gallery catalog', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(inFile(found, 'module-imports.gallery.ts')).toEqual([])
        expect(inFile(found, 'module-imports.tour.ts')).toEqual([
            'module-imports.tour.ts:7',
        ])
    })
})
