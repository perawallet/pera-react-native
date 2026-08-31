#!/usr/bin/env node
// Compares the old guardrails runner against lanekeep on the same corpus.
// Both tools report 1-based line and column, so tuples compare directly.
// Deleted once the migration lands.

import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

const ROOT = resolve(import.meta.dirname, '../..')

function usageError(message) {
    console.error(`error: ${message}`)
    console.error(
        'usage: compare.mjs [--rule <rule-id>]\n' +
            '  <rule-id> is a lanekeep rule id (namespace stripped), and must\n' +
            '  currently be registered in lanekeep.config.ts.',
    )
    process.exit(2)
}

const ruleFlagIndex = process.argv.indexOf('--rule')
const ruleGiven = ruleFlagIndex !== -1
const ruleValueRaw = ruleGiven ? process.argv[ruleFlagIndex + 1] : undefined
// An absent, empty, or flag-shaped value means no id was actually supplied.
// Left unchecked this silently sets `only` to something that matches
// nothing on either side, both sets end up empty, and the run reports a
// hollow AGREE — success proven by comparing nothing against nothing.
if (
    ruleGiven &&
    (ruleValueRaw === undefined ||
        ruleValueRaw === '' ||
        ruleValueRaw.startsWith('--'))
) {
    usageError('--rule requires a rule id (e.g. --rule no-numeric-sizes)')
}
const only = ruleGiven ? ruleValueRaw : null

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

// What "ported" means MUST come from what is registered in lanekeep.config.ts,
// never from what lanekeep emitted. Deriving it from output makes a rule that
// is registered but broken (typo'd node type, wrong AST shape, an over-narrow
// `fileContains`/`pathMatches` gate — anything that silently matches zero
// files) indistinguishable from a rule nobody has ported yet: both emit
// nothing. That would make the harness blind to exactly the failure mode a
// ported rule most needs catching before it ships.
function registeredRuleIds() {
    let out
    try {
        out = execFileSync('./node_modules/.bin/lanekeep', ['rules', '--json'], {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 8 * 1024 * 1024,
        })
    } catch (err) {
        throw new Error(
            `"lanekeep rules --json" failed: ${err.stderr ?? err.message}`,
        )
    }
    let parsed
    try {
        parsed = JSON.parse(out)
    } catch (err) {
        throw new Error(
            `could not parse "lanekeep rules --json" output as JSON: ${err.message}\n${out}`,
        )
    }
    if (!Array.isArray(parsed.rules)) {
        throw new Error(
            `"lanekeep rules --json" did not return a rules array: ${out}`,
        )
    }
    return new Set(parsed.rules.map(r => strip(r.id)))
}

const registered = registeredRuleIds()
if (only !== null && !registered.has(only)) {
    usageError(
        `unknown rule "${only}" — not currently registered in lanekeep.config.ts. ` +
            `Registered: ${[...registered].sort().join(', ') || '(none)'}`,
    )
}

const inScope = v =>
    (only === null || strip(v.ruleId) === only) &&
    !IGNORED_BY_LANEKEEP.has(v.file)
const a = new Map(guardrails().filter(inScope).map(v => [key(v), v]))
const b = new Map(lanekeep().filter(inScope).map(v => [key(v), v]))

// A rule not yet registered has no lanekeep side at all; comparing it would
// report every guardrails violation as missing, which is noise rather than a
// finding. A rule that IS registered but produced no output is not exempted
// here — it correctly falls through to MISSING below.
const relevant = k => registered.has(k.split('|')[0])

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
