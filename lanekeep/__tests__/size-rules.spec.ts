/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { locations, runRule } from './helpers.js'

const FIXTURES = 'lanekeep/__tests__/fixtures/size-rules.*'
const good = (file: string): boolean => /size-rules\.[a-z]+\.good\./.test(file)

describe('pera/no-numeric-sizes', () => {
    const run = () => runRule('lanekeep/rules/no-numeric-sizes.ts', FIXTURES)

    it('reports token arithmetic, numeric JSX size props and size constants that feed styles', async () => {
        const found = await run()

        expect(locations(found)).toEqual([
            'size-rules.component.bad.tsx:6',
            'size-rules.component.bad.tsx:7',
            'size-rules.component.bad.tsx:11',
            'size-rules.component.bad.tsx:15',
            'size-rules.component.bad.tsx:16',
            'size-rules.component.bad.tsx:18',
            'size-rules.styles.bad.ts:4',
            'size-rules.styles.bad.ts:5',
            'size-rules.styles.bad.ts:9',
            'size-rules.styles.bad.ts:24',
            'size-rules.styles.bad.ts:25',
            'size-rules.styles.bad.ts:26',
            'size-rules.styles.bad.ts:27',
            'size-rules.styles.bad.ts:28',
            'size-rules.styles.bad.ts:30',
            'size-rules.styles.bad.ts:32',
            'size-rules.styles.bad.ts:35',
        ])
    })

    it('words each kind of violation', async () => {
        const messages = (await run()).map(v => v.message)

        expect(messages).toEqual(
            expect.arrayContaining([
                'theme-token arithmetic "theme.spacing.xl + 20" — use one theme token',
                'theme-token arithmetic "(theme.spacing.xl + 2 * theme.spacing.sm) / 2" — use one theme token',
                'theme-token arithmetic "theme.spacing[\'5xl\'] * 2" — use one theme token',
                'numeric value 16 for JSX prop "width" — use a theme token',
                'module constant KEY_SIZE = 72 feeds styles — use a theme token at the use site',
                'module constant ICON_SIZE = 20 feeds styles — use a theme token at the use site',
                'module constant LOADER_SIZE = 32 feeds styles — use a theme token at the use site',
                'module constant BADGE_SIZE = 24 feeds styles — use a theme token at the use site',
            ]),
        )
    })

    it('reports a size constant only when a style or size prop reads it', async () => {
        const found = await run()

        expect(found.filter(v => v.message.includes('PAGE_SIZE'))).toEqual([])
        expect(found.filter(v => v.message.includes('BASE_WIDTH'))).toEqual([])
        expect(found.filter(v => v.message.includes('LOGO_SIZE'))).toEqual([])
    })

    it('leaves typography constants to pera/no-typography-in-styles', async () => {
        const found = await run()

        expect(
            found.filter(v => /FONT_SIZE|LINE_HEIGHT/.test(v.message)),
        ).toEqual([])
    })

    it('allows inset arithmetic, a lone negated token, a 0 size and a suppressed prop', async () => {
        const found = await run()

        expect(found.filter(v => good(v.file))).toEqual([])
    })
})

describe('pera/no-typography-in-styles size constants', () => {
    it('reports font-size and line-height constants that feed typography', async () => {
        const found = await runRule(
            'lanekeep/rules/no-typography-in-styles.ts',
            FIXTURES,
        )

        expect(locations(found)).toEqual([
            'size-rules.styles.bad.ts:6',
            'size-rules.styles.bad.ts:7',
            'size-rules.styles.bad.ts:8',
            'size-rules.styles.bad.ts:10',
        ])
        expect(found.map(v => v.message)).toEqual([
            'module constant TAG_FONT_SIZE = 13 sets typography — use getTypography or a PWText variant',
            'module constant ROW_LINE_HEIGHT = 20 sets typography — use getTypography or a PWText variant',
            'module constant CAPTION_FONT_SIZE = 11 sets typography — use getTypography or a PWText variant',
            'module constant TITLE_FONT_SIZE = 18 sets typography — use getTypography or a PWText variant',
        ])
    })
})
