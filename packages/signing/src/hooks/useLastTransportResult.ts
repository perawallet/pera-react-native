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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSigningStore } from '../store'
import type { TransportResult } from '../pipeline/types'

/**
 * Granular selector for `lastTransportResult` only. Prefer this over
 * `useSigningRequest()` when a consumer reacts to transport completions but
 * doesn't need the full request API — avoids re-renders on unrelated store
 * fields (pendingSignRequests, lastCompletedRequest, lastFailedRequest, …).
 */
export const useLastTransportResult = (): Nullable<TransportResult> =>
    useSigningStore(state => state.lastTransportResult)
