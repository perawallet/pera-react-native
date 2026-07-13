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
    use: {
        trace: 'retain-on-failure',
    },
})
