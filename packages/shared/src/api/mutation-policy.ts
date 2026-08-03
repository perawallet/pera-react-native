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

import { onlineManager } from '@tanstack/react-query'
import { NoConnectionError } from '../errors/network-validation'

/**
 * Single source of truth for the app's mutation policy. Mirrored by
 * package-level test wrappers, since packages can't import from `apps/mobile`.
 *
 * - `networkMode: 'always'` — the mutationFn runs even offline so the transport
 *   rejects immediately, instead of TanStack *pausing* the mutation
 *   (`mutateAsync` never settling) and silently auto-resuming later. Forbidden
 *   for anything that moves money. `resumePausedMutations` is deliberately not
 *   wired: fail-fast, not queue-and-replay.
 * - `throwOnError: false` — failures surface as `mutation.error` rather than
 *   re-throwing during render and crashing consumers outside an error boundary.
 */
export const mutationDefaults = {
    throwOnError: false,
    networkMode: 'always',
} as const

/**
 * Fails before signing starts, rather than letting a partially-built
 * transaction reach a transport that will reject it. Note `isOnline` is a
 * METHOD — read as a property it's always truthy and the guard never fires.
 */
export const assertOnline = (): void => {
    if (!onlineManager.isOnline()) {
        throw new NoConnectionError()
    }
}
