#!/usr/bin/env node
// Compares the old guardrails runner against lanekeep on the same corpus.
// Both tools report 1-based line and column, so tuples compare directly.
// Deleted once the migration lands.

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

const ROOT = resolve(import.meta.dirname, '../..')
const only = process.argv.includes('--rule')
    ? process.argv[process.argv.indexOf('--rule') + 1]
    : null

// Rule ids differ by namespace between the two tools.
const strip = id => id.replace(/^pera\//, '')
const key = v => `${strip(v.ruleId)}|${v.file}|${v.line}|${v.column}`

// The two tools emit different JSON shapes. guardrails is already flat;
// lanekeep nests position under `location` and spells the id `rule_id`.
const fromLanekeep = v => ({
    ruleId: v.rule_id,
    file: v.location.file,
    line: v.location.position.line,
    column: v.location.position.column,
    message: v.message,
})

// lanekeep is gitignore-aware and guardrails is not, so a gitignored file under
// a scanned path is seen by one tool only. Comparing it reports a phantom diff.
const IGNORED_BY_LANEKEEP = new Set(['packages/config/src/generated-env.ts'])

function guardrails() {
    let out
    try {
        out = execFileSync('pnpm', ['--silent', 'lint:guardrails:json'], {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            env: { ...process.env, GUARDRAILS_NO_SUPPRESS: '1' },
        })
    } catch (err) {
        // Exit 1 means violations found, which is expected.
        if (err.status !== 1) throw err
        out = err.stdout
    }
    return JSON.parse(out).violations
}

function lanekeep() {
    let out
    try {
        out = execFileSync(
            './node_modules/.bin/lanekeep',
            ['check', '--format', 'json'],
            { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
        )
    } catch (err) {
        // Exit 1 means violations found, which is expected.
        if (err.status !== 1) throw err
        out = err.stdout
    }
    return JSON.parse(out).violations.map(fromLanekeep)
}

const inScope = v =>
    (only === null || strip(v.ruleId) === only) &&
    !IGNORED_BY_LANEKEEP.has(v.file)
const a = new Map(guardrails().filter(inScope).map(v => [key(v), v]))
const b = new Map(lanekeep().filter(inScope).map(v => [key(v), v]))

// A rule not yet ported has no lanekeep side; comparing it would report every
// guardrails violation as missing, which is noise rather than a finding.
const ported = new Set([...b.keys()].map(k => k.split('|')[0]))
const relevant = k => ported.has(k.split('|')[0])

const missing = [...a.keys()].filter(k => relevant(k) && !b.has(k)).sort()
const extra = [...b.keys()].filter(k => !a.has(k)).sort()

for (const k of missing) console.log(`MISSING (guardrails only): ${k}`)
for (const k of extra) console.log(`EXTRA (lanekeep only):     ${k}`)

const verdict = missing.length === 0 && extra.length === 0
console.log(
    verdict
        ? `\nAGREE — ${a.size} guardrails / ${b.size} lanekeep violation(s)`
        : `\nDISAGREE — ${missing.length} missing, ${extra.length} extra`,
)
process.exit(verdict ? 0 : 1)
