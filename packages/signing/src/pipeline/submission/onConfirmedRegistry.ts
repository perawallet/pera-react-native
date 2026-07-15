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

import type { Network } from '@perawallet/wallet-core-shared'

export type OnConfirmedHandler = (
    affectedAddresses: string[],
    network: Network,
) => void | Promise<void>

let registered: OnConfirmedHandler | null = null

/**
 * Register the global handler invoked after a submitted-and-confirmed
 * transaction group involves wallet-held addresses. App-level code wires
 * this once at startup to bridge signing → sync without creating a
 * package-level dependency edge from `signing` to `background`.
 *
 * Calling with `null` clears the handler (useful for tests).
 */
export const setOnConfirmedHandler = (
    handler: OnConfirmedHandler | null,
): void => {
    registered = handler
}

/**
 * Read the currently-registered handler. Returns `null` when no handler is
 * wired — callers should treat this as "skip the auto-refresh side effect"
 * rather than as an error, so the signing pipeline still works in
 * environments (tests, headless tools) that have not opted into refresh.
 */
export const getOnConfirmedHandler = (): OnConfirmedHandler | null => registered
