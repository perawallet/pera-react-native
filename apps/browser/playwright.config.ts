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

import { readdirSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@playwright/test'

const testDir = path.join(import.meta.dirname, 'e2e')

// Seconds per spec on a CI runner, beforeAll included: Playwright's own
// --shard balances by test count, and these specs differ by 40x in cost.
// Re-measure from a run's list-reporter output when one shard trails.
const SPEC_SECONDS: Record<string, number> = {
    'quantum-import.spec.ts': 49,
    'wallet-smoke.spec.ts': 33,
    'delete-all-data.spec.ts': 32,
    'passkey-provider.spec.ts': 24,
    'walletconnect.spec.ts': 21,
    'onboarding.spec.ts': 19,
    'cloud-backup-restore.spec.ts': 19,
    'feature-tabs.spec.ts': 17,
    'deeplinks.spec.ts': 15,
    'quantum-account.spec.ts': 14,
    'window-pera.spec.ts': 13,
    'screenshots.spec.ts': 12,
    'connect-modal-hook.spec.ts': 11,
}
const DEFAULT_SPEC_SECONDS = 5

/**
 * The specs shard `index` of `count` runs, from E2E_SHARD ("2/4"). Each spec
 * goes to the lightest shard so far, heaviest first, so a new spec lands in
 * exactly one shard without being listed.
 */
const specsForShard = (shard: string): string[] => {
    const [index, count] = shard.split('/').map(Number)
    const specs = readdirSync(testDir)
        .filter(file => file.endsWith('.spec.ts'))
        .sort(
            (a, b) =>
                (SPEC_SECONDS[b] ?? DEFAULT_SPEC_SECONDS) -
                    (SPEC_SECONDS[a] ?? DEFAULT_SPEC_SECONDS) ||
                a.localeCompare(b),
        )
    const shards = Array.from({ length: count }, () => ({
        seconds: 0,
        specs: [] as string[],
    }))
    for (const spec of specs) {
        const lightest = shards.reduce((min, next) =>
            next.seconds < min.seconds ? next : min,
        )
        lightest.seconds += SPEC_SECONDS[spec] ?? DEFAULT_SPEC_SECONDS
        lightest.specs.push(spec)
    }
    return shards[index - 1].specs
}

export default defineConfig({
    testDir,
    ...(process.env.E2E_SHARD && {
        testMatch: specsForShard(process.env.E2E_SHARD),
    }),
    timeout: 120_000,
    // Extension state (chrome.storage) persists per launch context; keep
    // workers at 1 so tests don't share/clobber a profile.
    workers: 1,
    // CI only — local runs stay strict so a real failure is loud while you
    // develop. A retry re-runs the whole serial `describe` against a fresh
    // browser context, which is what actually clears a harness-level race.
    //
    // #1397 proposed this and was correctly closed: at the time the WC failure
    // was 100% deterministic (an approval marked `surface: 'window'` that
    // `get-current-approval` filters out forever), so retrying failed three
    // times identically. #1400 fixed that, and the races left are genuinely
    // transient — a single flake otherwise reddens the whole job AND, because
    // both remaining offenders use `mode: 'serial'`, takes its siblings down as
    // "did not run".
    //
    // This masks nothing: Playwright reports a recovered run as **flaky**, not
    // passed, so the raciness stays in the report. Retries are the floor under
    // a green build, not a substitute for fixing the cause — the outstanding
    // one is a real signing failure, tracked in the PR.
    retries: process.env.CI ? 2 : 0,
    use: {
        trace: 'retain-on-failure',
    },
})
