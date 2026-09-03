/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    MAKE_STYLES_QUERY,
    isRneuiMakeStyles,
    styleEntries,
} from '../shared/make-styles.js'

export default defineRule({
    id: 'pera/no-empty-style-objects',
    severity: 'error',
    card: {
        message: 'empty style entry',
        remediation:
            'Remove the empty style key, or fill in real properties. An empty entry produces no styles and only adds noise.',
        examples: { bad: 'empty: {}', good: 'row: { flexDirection: "row" }' },
    },
    gates: { fileContains: ['makeStyles'] },
    query: MAKE_STYLES_QUERY,
    check(ctx, m) {
        const call = m.call
        const fn = m.fn
        if (call === undefined || fn === undefined) return
        if (!isRneuiMakeStyles(ctx, fn)) return

        for (const entry of styleEntries(ctx, call)) {
            if (ctx.namedChildren(entry.value).length > 0) continue
            ctx.report(
                entry.value,
                `style entry "${entry.key}" has an empty body`,
            )
        }
    },
})
