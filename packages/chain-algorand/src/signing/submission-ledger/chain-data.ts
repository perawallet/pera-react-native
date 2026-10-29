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

import type { ChainSubmissionData } from '@perawallet/wallet-core-chain-contract'
import type { SubmissionAttempt } from '@perawallet/wallet-core-signing'
import type { Optional, Nullable } from '@perawallet/wallet-core-shared'

/** Undefined when the round couldn't be decoded, leaving the attempt unevaluatable. */
export const algorandSubmissionChainData = (
    lastValid: Optional<number>,
): Optional<ChainSubmissionData> =>
    lastValid === undefined ? undefined : { family: 'algorand', lastValid }

export const lastValidOf = (
    attempt: Pick<SubmissionAttempt, 'chainData'>,
): Nullable<number> =>
    attempt.chainData?.family === 'algorand'
        ? attempt.chainData.lastValid
        : null
