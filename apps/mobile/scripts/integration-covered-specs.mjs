#!/usr/bin/env node
/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Rewrites vitest.integration-covered.json from an integration coverage run
// (`pnpm --filter mobile test:integration-covered:update`). A unit spec is
// listed when the integration suite alone runs nearly all of its subject's
// statements and branches. Components stay out: flows render them but
// never assert their contract.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const MIN_STATEMENTS_PCT = 95
const MIN_BRANCHES_PCT = 90

const root = path.resolve(import.meta.dirname, '..')
const coverage = JSON.parse(
    readFileSync(
        path.join(root, 'coverage/integration/coverage-final.json'),
        'utf8',
    ),
)

const percentHit = counts =>
    counts.length === 0
        ? 100
        : (100 * counts.filter(count => count > 0).length) / counts.length

const findSpecs = dir =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            return entry.name === '__integration__' ? [] : findSpecs(full)
        }
        return /\.spec\.tsx?$/.test(entry.name) ? [full] : []
    })

const subjectOf = spec => {
    const base = path.basename(spec).replace(/\.spec\.tsx?$/, '')
    const dir = path.dirname(path.dirname(spec))
    return [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
    ]
        .map(candidate => path.join(dir, candidate))
        .find(existsSync)
}

const isCovered = subject => {
    const file = coverage[subject]
    if (!file || Object.keys(file.s).length === 0) return false
    return (
        percentHit(Object.values(file.s)) >= MIN_STATEMENTS_PCT &&
        percentHit(Object.values(file.b).flat()) >= MIN_BRANCHES_PCT
    )
}

const covered = findSpecs(path.join(root, 'src'))
    .filter(spec => path.basename(path.dirname(spec)) === '__tests__')
    .filter(
        spec =>
            !spec.includes(`${path.sep}src${path.sep}components${path.sep}`),
    )
    .filter(spec => {
        const subject = subjectOf(spec)
        return subject !== undefined && isCovered(subject)
    })
    .map(spec => path.relative(root, spec))
    .sort()

writeFileSync(
    path.join(root, 'vitest.integration-covered.json'),
    `${JSON.stringify(covered, null, 4)}\n`,
)
console.log(`${covered.length} unit specs covered by the integration suite`)
