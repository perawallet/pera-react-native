/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { WORK_ITEM } from '../../tools/lib/work-item-pattern.mjs'

type HistoryKind =
    | 'work-item'
    | 'pr-reference'
    | 'narration'
    | 'measured-timing'
type HistoryHit = { kind: HistoryKind; phrase: string }

// A noun subject reads the same as the passive, so the first form needs a
// pronoun subject and the second must not follow a be-form, modal or conjunction.
const BEFORE_PASSIVE = String.raw`(?:is|are|was|were|be|been|being|get|gets|got|getting|isn't|aren't|wasn't|weren't|can|could|may|might|must|should|will|would|not|only|also|then|and|or)`
// Runtime state ("the previously selected account"), not history.
const STATE_PARTICIPLE = String.raw`(?:selected|synced|correct|first|picked|persisted|derived|open|stored|saved|imported|added|seen|cached|focused|connected|committed|set)`
const NARRATION: readonly RegExp[] = [
    /\b(?:this|it|they|we|that|which|who|there|these|those)\s+(?:all\s+|both\s+|each\s+|once\s+|also\s+)?used to\b/i,
    new RegExp(
        String.raw`(?<!\b${BEFORE_PASSIVE}\s+)(?<![,;:(—–-]\s*)\bused to (?:be|also|always|never|just|silently)\b`,
        'i',
    ),
    new RegExp(
        String.raw`(?<!\b(?:added|selected|saved|stored|seen|persisted)\s+)\bpreviously\b(?!-\w|\s"?${STATE_PARTICIPLE}\b)`,
        'i',
    ),
    /\b(?:was|were|has been|have been|had been|got) renamed\b|\brenamed from\b/i,
    /\bformerly\b/i,
]
// Three digits at least: "(#1)" is account numbering. A bare `#NNN` counts only
// after "PR", as a pre/post prefix or opening a sentence, so "Bored Ape #1234"
// and upstream refs stay clear.
const PR_REFERENCE =
    /\(#\d{3,}\)|\bPR\s?#\d+\b|\b(?:pre|post)-#\d+\b|(?:^|[.:;!?]\s+)#\d{3,}\b/i
// A bare duration is usually configuration ("a 10s default"); it counts as a
// measurement only beside a word that marks it as observed ("takes" needs a
// "~" estimate, since "takes a 30s timeout" is configuration).
const MEASURED_TIMING =
    /\b(?:took|sat|measured|observed|outran|overran|p(?:50|90|95|99))\b[^.;]{0,40}?~?\d+(?:\.\d+)?\s?(?:ms|s)\b|\b(?:takes|taking)\s+~\d+(?:\.\d+)?\s?(?:ms|s)\b|~?\b\d+(?:\.\d+)?\s?(?:ms|s)\b[^.;]{0,40}?\b(?:took|sat|locally|on a dev laptop|on a loaded runner)\b/i

// Tree-sitter prefilters with Rust's regex: Unicode `\b`/`\d`, no lookbehind,
// and flags don't carry over. `check` re-tests in JS, so the gap can drop a
// report but never add one. The node text is raw, so the duration term also
// spans a block-comment `*` or docstring indent that `commentProse` collapses.
// Query string literals unescape `\\` and `\"`.
const PREFILTER = String.raw`(?i:used|previously|renamed|formerly|#\d|\d[\s*]*m?s\b)`
const PREDICATE = `${WORK_ITEM.source}|${PREFILTER}`
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
const COMMENT_QUERY = `((comment) @comment (#match? @comment "${PREDICATE}"))`
const PY_DOCSTRING_QUERY = `((expression_statement (string) @comment) (#match? @comment "${PREDICATE}"))`

const LEADING_MARKER =
    /^\s*(?:\/\*\*?|\/\/+|\*\/?|#+(?!\d)|[rbu]{0,2}(?:"""|'''))\s?/i
const TRAILING_MARKER = /\s*(?:\*\/|"""|''')\s*$/

const MESSAGES: Record<HistoryKind, (phrase: string) => string> = {
    'work-item': p =>
        `references "${p}", which will mean nothing in six months`,
    'pr-reference': p =>
        `references PR "${p}", which will mean nothing in six months`,
    narration: p =>
        `narrates history ("${p}"); say what the code does now and why`,
    'measured-timing': p =>
        `quotes a measured timing ("${p}"), which expires; state the constraint it sets`,
}

// Joins a block comment or docstring into one line so a phrase split across
// lines still matches.
function commentProse(text: string): string {
    return text
        .split('\n')
        .map(line => line.replace(LEADING_MARKER, ''))
        .join(' ')
        .replace(TRAILING_MARKER, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function findHistory(text: string): HistoryHit | undefined {
    const workItem = WORK_ITEM.exec(text)
    if (workItem !== null) return { kind: 'work-item', phrase: workItem[0] }

    const prose = commentProse(text)
    const pr = PR_REFERENCE.exec(prose)
    if (pr !== null) {
        return {
            kind: 'pr-reference',
            phrase: /#\d+/.exec(pr[0])?.[0] ?? pr[0],
        }
    }
    for (const pattern of NARRATION) {
        const hit = pattern.exec(prose)
        if (hit !== null) return { kind: 'narration', phrase: hit[0] }
    }
    const timing = MEASURED_TIMING.exec(prose)
    if (timing !== null) return { kind: 'measured-timing', phrase: timing[0] }
    return undefined
}

export default defineRule({
    id: 'pera/no-work-item-refs',
    language: ['typescript', 'tsx', 'javascript', 'python'],
    severity: 'error',
    card: {
        message: 'a comment references a work item or narrates history',
        remediation:
            'State the reason itself: the constraint the code meets now. Git and the tracker hold the history; a ticket or PR number, past behaviour or a one-off timing means nothing to a reader in six months. Delete the comment if the code already says it.',
        examples: {
            bad: '// Workaround for PERA-1234: this used to retry twice',
            good: '// Android drops the first frame after resume, so retry once',
        },
    },
    query: {
        typescript: COMMENT_QUERY,
        tsx: COMMENT_QUERY,
        javascript: COMMENT_QUERY,
        python: `${COMMENT_QUERY}\n${PY_DOCSTRING_QUERY}`,
    },
    check(ctx, m) {
        const comment = m.comment
        if (comment === undefined) return
        const hit = findHistory(ctx.text(comment) ?? '')
        if (hit === undefined) return
        ctx.report(comment, MESSAGES[hit.kind](hit.phrase))
    },
})
