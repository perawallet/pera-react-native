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

import type { SignRequest } from '../../models'

/**
 * Returns the next request to process, or undefined if the queue
 * is blocked (an actor is already running) or empty.
 *
 * Only one signing actor runs at a time to prevent UI collisions
 * (overlapping bottom sheets, concurrent biometric prompts).
 */
export const getNextQueuedRequest = (
    pendingRequests: SignRequest[],
    runningActorCount: number,
): SignRequest | undefined => {
    if (runningActorCount > 0) return undefined
    return pendingRequests.at(0)
}
