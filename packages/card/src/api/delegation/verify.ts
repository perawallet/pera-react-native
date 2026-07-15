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

import { config } from '@perawallet/wallet-core-config'
import { encodeToBase64, type Network } from '@perawallet/wallet-core-shared'

/** The delegation program didn't match the pinned program for the network. */
export class DelegationProgramUnverifiedError extends Error {
    constructor(network: Network) {
        super(`Delegation program failed verification on ${network}`)
        this.name = 'DelegationProgramUnverifiedError'
    }
}

// ─── SWAP POINT: Baanx Algorand delegation contract (not shipped) ───────────
// Pinned expected program bytes (base64) per network — EMPTY until Baanx ships
// the real contract, so production refuses to sign any delegation program. When
// it lands, pin the compiled program here AND confirm the TEAL bounds the per-tx
// allowance, receiver and expiry (the AUTO_FUNDING_PER_TX_LIMIT_USD cap is
// otherwise only a Baanx-side value, never signed). See models/funding.ts.
const EXPECTED_PROGRAMS: Partial<Record<Network, string>> = {}
// ─── END SWAP POINT ──────────────────────────────────────────────────────────

/**
 * Refuses to sign a server-supplied delegation program unless its bytes match
 * the pinned program for the network. Skipped outside production, where the
 * dev-only mock stands in for the unshipped contract.
 */
export const verifyDelegationProgram = (
    program: Uint8Array,
    network: Network,
): void => {
    if (config.appEnvironment !== 'production') return
    // An unpinned network has no expected value, so this always rejects until a
    // program is pinned above.
    if (encodeToBase64(program) !== EXPECTED_PROGRAMS[network]) {
        throw new DelegationProgramUnverifiedError(network)
    }
}
