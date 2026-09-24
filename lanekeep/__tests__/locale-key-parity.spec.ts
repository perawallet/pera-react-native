/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    REPO_ROOT,
    createRunner,
    locations,
    runRule,
    withScratch,
} from './helpers.js'

const RULE = 'lanekeep/rules/locale-key-parity.ts'
const ROOT = 'lanekeep/__tests__/fixtures/i18n-parity'
const FIXTURES = `${ROOT}/**/*.ts`
const I18N = 'apps/mobile/src/i18n'

describe('pera/locale-key-parity', () => {
    it('reports keys missing from a locale and keys en.json does not have', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(locations(found).sort()).toEqual([
            'de.json:6',
            'en.json:7',
            'pt.json:4',
        ])
    })

    it('names the key and the locale in each finding', async () => {
        const messages = (await runRule(RULE, FIXTURES)).map(v => v.message)

        expect(messages).toContain(
            '"gone" is in en.json but missing from de.json',
        )
        expect(messages).toContain(
            '"common.extra" is in de.json but not in en.json',
        )
        expect(messages).toContain(
            '"common.ok_zero" is in pt.json but not in en.json',
        )
    })

    it('sees a locale file edited with no TS file touched, on a warm cache', async () => {
        const files: Record<string, string> = {}
        for (const name of [
            'locales.ts',
            'locales/en.json',
            'locales/de.json',
        ]) {
            files[`${I18N}/${name}`] = await readFile(
                join(REPO_ROOT, ROOT, I18N, name),
                'utf8',
            )
        }
        files[`${I18N}/locales.ts`] =
            "import de from './locales/de.json'\nimport en from './locales/en.json'\n\nexport const bundles = { de, en }\n"

        await withScratch(files, async dir => {
            const runner = await createRunner(RULE, `${dir}/**/*.ts`)
            try {
                expect(await runner.run()).toHaveLength(2)

                const de = join(REPO_ROOT, dir, I18N, 'locales/de.json')
                const fixed = JSON.parse(await readFile(de, 'utf8')) as {
                    common: Record<string, string>
                    gone?: string
                }
                delete fixed.common.extra
                fixed.gone = 'Weg'
                await writeFile(de, JSON.stringify(fixed, null, 4))

                expect(await runner.run()).toEqual([])
            } finally {
                await runner.dispose()
            }
        })
    })
})
