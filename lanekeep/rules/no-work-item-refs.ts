/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { WORK_ITEM } from '../../tools/lib/work-item-pattern.mjs'

// Tree-sitter prefilters with Rust's regex: Unicode `\b`/`\d`, and flags don't
// carry over. `check` re-tests in JS, so the gap can drop a report but never
// add one. Query string literals unescape `\\` and `\"`.
const PREDICATE = WORK_ITEM.source.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

export default defineRule({
    id: 'pera/no-work-item-refs',
    language: ['typescript', 'tsx', 'javascript'],
    severity: 'error',
    card: {
        message: 'a comment references a work item',
        remediation:
            'State the reason itself. Git and the tracker hold the history; a ticket or task number means nothing to a reader in six months.',
        examples: {
            bad: '// Workaround for PERA-1234',
            good: '// Android drops the first frame after resume, so retry once',
        },
    },
    query: `((comment) @comment (#match? @comment "${PREDICATE}"))`,
    check(ctx, m) {
        const comment = m.comment
        if (comment === undefined) return
        const hit = WORK_ITEM.exec(ctx.text(comment) ?? '')
        if (hit === null) return
        ctx.report(
            comment,
            `references "${hit[0]}", which will mean nothing in six months`,
        )
    },
})
