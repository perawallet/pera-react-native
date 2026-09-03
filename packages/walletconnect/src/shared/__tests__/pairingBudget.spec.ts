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

import { describe, expect, it, vi } from 'vitest'
import { WC_SESSION_OUTCOME_TIMEOUT_MS } from '../constants'

// The subpath, not the barrel: the barrel reaches the signing adapter and with
// it react-native-mmkv, which cannot load here.
import { CONNECTION_OUTCOME_TIMEOUT_MS } from '@perawallet/wallet-core-connections/pairingOutcome'

// `constants.ts` re-exports three limits from the signing barrel, which
// cannot load here either.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 1000,
    MAX_TRANSACTION_SIGN_REQUESTS: 1000,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
}))

describe('WC_SESSION_OUTCOME_TIMEOUT_MS', () => {
    // The offscreen host's correlation-cleanup timer is armed for this value
    // plus slack and must outlive the registry-side wait for the same answer.
    it('equals the connections package budget it mirrors', () => {
        expect(WC_SESSION_OUTCOME_TIMEOUT_MS).toBe(
            CONNECTION_OUTCOME_TIMEOUT_MS,
        )
    })
})
