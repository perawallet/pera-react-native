#!/usr/bin/env node
// Doc and comment hygiene. Catches the drift a reviewer stops noticing:
// references to work items that mean nothing in six months, and paths that
// have quietly stopped existing.
//
// Usage: node tools/check-doc-hygiene.mjs [--warn-only] [--json]

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const warnOnly = process.argv.includes('--warn-only')
const asJson = process.argv.includes('--json')

const WORK_ITEM = /\b(?:PERA-\d+|PQ-0\d\d|IAB-\d+|WB-\d+|Task \d+|M\d+ [Tt]ask)\b/
const DOC_LINE_BUDGET = 400

// Wrongness fails the check. Length is a smell that needs a human to judge, so
// it reports without failing.
const SEVERITY = {
    'no-work-item-refs': 'error',
    'dead-link': 'error',
    'stale-path': 'error',
    'doc-too-long': 'warn',
}

// An exception with a recorded reason, on the line above the offender:
//   doc-hygiene-ignore-next-line stale-path reason: written by CI at build time
const IGNORE = /doc-hygiene-ignore-next-line\s+([\w-]+)\s+reason:\s*\S/

// Paths we can resolve on disk. Templates and globs are not claims about
// reality, so they are skipped rather than reported.
const UNRESOLVABLE = /[<>*{}\[\]…?]|\$\{/
const REPO_ROOTS =
    /^(apps|packages|extensions|tools|docs|conformance|specs|patches|\.github|\.claude)\//

const tracked = execFileSync(
    'git',
    ['ls-files', '*.md', '*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs', '*.sh', '*.yml'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
    .split('\n')
    .filter(Boolean)
    .filter(f => !f.includes('/dist/') && !f.includes('node_modules'))

const findings = []
let suppressed = 0
const add = (rule, file, line, message, remediation, lines) => {
    // Skip back over blank lines: a formatter may separate the directive from
    // the line it covers.
    for (let i = line - 2; i >= 0 && i >= line - 4; i--) {
        const prev = lines?.[i] ?? ''
        if (prev.trim() === '') continue
        const m = prev.match(IGNORE)
        if (m && m[1] === rule) {
            suppressed++
            return
        }
        break
    }
    findings.push({
        rule,
        severity: SEVERITY[rule] ?? 'error',
        file,
        line,
        message,
        remediation,
    })
}

const isComment = l => {
    const s = l.trim()
    return (
        s.startsWith('//') ||
        s.startsWith('*') ||
        s.startsWith('/*') ||
        s.startsWith('#')
    )
}

for (const file of tracked) {
    const isMarkdown = file.endsWith('.md')
    let text
    try {
        text = readFileSync(join(ROOT, file), 'utf8')
    } catch {
        continue
    }
    const lines = text.split('\n')

    // This file names the patterns it forbids, and CLAUDE.md quotes them as
    // examples, so neither can be scanned for them.
    const selfReferential =
        file === 'tools/check-doc-hygiene.mjs' ||
        file === 'CLAUDE.md' ||
        file === '.claude/skills/writing-docs/SKILL.md'

    lines.forEach((raw, i) => {
        const n = i + 1
        if (!selfReferential && (isMarkdown || isComment(raw))) {
            const hit = raw.match(WORK_ITEM)
            if (hit) {
                add(
                    'no-work-item-refs',
                    file,
                    n,
                    `references "${hit[0]}", which will mean nothing in six months`,
                    'State the reason itself. Git and the tracker hold the history.',
                    lines,
                )
            }
        }

        if (!isMarkdown) return

        // Markdown links to files in this repo.
        for (const m of raw.matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
            const target = m[1]
            if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue
            if (UNRESOLVABLE.test(target)) continue
            const abs = target.startsWith('/')
                ? join(ROOT, target)
                : resolve(ROOT, dirname(file), target)
            if (!existsSync(abs)) {
                add(
                    'dead-link',
                    file,
                    n,
                    `links to "${target}", which does not exist`,
                    'Point at a real file, or drop the link.',
                    lines,
                )
            }
        }

        // Backticked repo paths asserted as fact.
        for (const m of raw.matchAll(/`([^`\n]+)`/g)) {
            const p = m[1].trim().replace(/[.,;:)]+$/, '')
            if (!REPO_ROOTS.test(p) || UNRESOLVABLE.test(p)) continue
            if (p.includes(' ')) continue
            if (!existsSync(join(ROOT, p))) {
                add(
                    'stale-path',
                    file,
                    n,
                    `names \`${p}\`, which is not in the repo`,
                    'Check the path. A doc that points at a moved file is worse than no doc.',
                    lines,
                )
            }
        }
    })

    if (isMarkdown && file.startsWith('docs/') && lines.length > DOC_LINE_BUDGET) {
        add(
            'doc-too-long',
            file,
            1,
            `${lines.length} lines, over the ${DOC_LINE_BUDGET}-line budget`,
            'Split it, or cut what the code already says.',
            lines,
        )
    }
}

if (asJson) {
    console.log(JSON.stringify({ findings }, null, 2))
} else if (findings.length === 0) {
    console.log(
        `✓ doc hygiene: no findings${suppressed ? ` (${suppressed} suppressed)` : ''}`,
    )
} else {
    const byRule = new Map()
    for (const f of findings) {
        console.log(`${f.file}:${f.line} [${f.rule}] ${f.message}`)
        console.log(`  → ${f.remediation}`)
        byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1)
    }
    console.log('')
    for (const [rule, count] of byRule)
        console.log(`${rule} (${SEVERITY[rule] ?? 'error'}): ${count}`)
    const errors = findings.filter(f => f.severity === 'error').length
    console.log(
        `\n✖ ${findings.length} finding(s), ${errors} blocking${suppressed ? `, ${suppressed} suppressed` : ''}`,
    )
}

const blocking = findings.filter(f => f.severity === 'error').length
process.exit(blocking > 0 && !warnOnly ? 1 : 0)
