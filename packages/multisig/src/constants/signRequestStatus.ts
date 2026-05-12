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

import type { SignRequestStatus } from '../models'

/** Statuses where the request is still progressing toward a terminal state. */
export const IN_FLIGHT_SIGN_REQUEST_STATUSES: ReadonlySet<SignRequestStatus> =
    new Set(['pending', 'ready', 'submitting'])

/** Statuses where the user can still sign or decline. */
export const ACTIONABLE_SIGN_REQUEST_STATUSES: ReadonlySet<SignRequestStatus> =
    new Set(['pending', 'ready'])

/** Terminal statuses — the request will not change again. */
export const FINALIZED_SIGN_REQUEST_STATUSES: ReadonlySet<SignRequestStatus> =
    new Set(['confirmed', 'failed', 'expired', 'declined'])

/** Terminal statuses representing an unsuccessful outcome. */
export const FAILURE_SIGN_REQUEST_STATUSES: ReadonlySet<SignRequestStatus> =
    new Set(['failed', 'expired', 'declined'])
