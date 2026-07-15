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
 * OFF-004: default options for every `useMutation`, and the single source of
 * truth for the app's mutation policy. Consumed by `QueryProvider` and mirrored
 * by package-level test wrappers (packages cannot import from `apps/mobile`).
 *
 * - `networkMode: 'always'` — the mutationFn always runs, even offline, so the
 *   transport rejects immediately instead of TanStack *pausing* the mutation
 *   (`mutateAsync` never settling) and silently auto-resuming when connectivity
 *   returns. Pause-and-auto-resume is forbidden for anything that moves money or
 *   applies optimistic UI. We deliberately do NOT wire `resumePausedMutations`:
 *   the policy is fail-fast, not queue-and-replay.
 * - `throwOnError: false` — failures surface as `mutation.error` state (the same
 *   contract as queries) instead of re-throwing during render, which would crash
 *   any consumer mounted outside an error boundary. User-facing surfacing stays
 *   at the call site.
 */
export const mutationDefaults = {
    throwOnError: false,
    networkMode: 'always',
} as const

/**
 * Money-flow hardening: throw before signing starts if the device is offline,
 * rather than letting a partially-built transaction reach a transport that will
 * reject. `onlineManager.isOnline` is a METHOD — reading it as a property is
 * always truthy and the guard never fires.
 */
export const assertOnline = (): void => {
    if (!onlineManager.isOnline()) {
        throw new NoConnectionError()
    }
}
