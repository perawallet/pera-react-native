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

import { isDev, isStaging } from '@perawallet/wallet-core-config'

const INTEGRITY_BYPASS_HEADER = 'x-bypass-integrity'
const INTEGRITY_BYPASS_VALUE = 'DEVELOPMENT_AND_STAGING_ONLY'

/**
 * Adds the backend's dev/staging app-integrity bypass header to `headers`
 * for every app-integrity-guarded call (fee-delegation, card creation, ...).
 * The header is a public, static opt-in string — the real gate is the
 * backend's own env flag, and dev/staging are the only variants it ever
 * honors this for regardless of what a client sends.
 */
export const addDeviceIntegrityHeader = (
    headers: Record<string, string>,
): Record<string, string> => ({
    ...headers,
    ...((isDev || isStaging) && {
        [INTEGRITY_BYPASS_HEADER]: INTEGRITY_BYPASS_VALUE,
    }),
})
