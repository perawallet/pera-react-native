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

import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
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
