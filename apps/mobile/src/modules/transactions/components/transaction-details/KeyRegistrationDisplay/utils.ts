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

import type {
    KeyRegType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

/**
 * Online iff a participation key is actually being registered.
 *
 * `nonParticipation` is NOT the offline flag — it means "never participate
 * again", and a plain de-registration leaves it false. Branching on it alone
 * labelled every offline keyreg "Online".
 */
export const getKeyRegType = (tx: PeraDisplayableTransaction): KeyRegType => {
    const keyreg = tx.keyregTransaction
    return keyreg?.voteParticipationKey && !keyreg.nonParticipation
        ? 'online'
        : 'offline'
}

/**
 * Participation keys are raw bytes, and `.toString()` on a Uint8Array renders
 * "75,64,203,…" — which a node runner cannot check against the base64 their
 * tooling printed. Base64 is the only form that round-trips against nodekit,
 * goal, and the ARC-78 URI itself.
 */
export const formatParticipationKey = (
    key: Uint8Array | undefined,
): string | undefined => (key ? encodeToBase64(key) : undefined)
