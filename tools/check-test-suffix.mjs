/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Fails when a JS/TS test file uses the `.test.` suffix instead of `.spec.`.
 *
 * The mobile vitest projects and the browser config only collect `*.spec.*`,
 * so a `.test.ts` there never runs and nothing reports it. Shell suites
 * (`tools/__tests__/*.test.sh`) are out of scope: CI selects them by that suffix.
 *
 * With no arguments it checks tracked and untracked (non-ignored) files; paths
 * passed as arguments are checked instead, which is how the shell harness drives it.
 */

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const TEST_SUFFIX = /\.test\.[cm]?[jt]sx?$/

const listFiles = () =>
    execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
        .split('\n')
        .filter(Boolean)

const args = process.argv.slice(2)
const offenders = (args.length > 0 ? args : listFiles()).filter(file =>
    TEST_SUFFIX.test(path.basename(file)),
)

if (offenders.length > 0) {
    console.error(
        'Test files must use the .spec suffix (.spec.ts / .spec.tsx), not .test:',
    )
    for (const file of offenders) console.error(`  ${file}`)
    process.exit(1)
}

console.log('All JS/TS test files use the .spec suffix.')
