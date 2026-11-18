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

import { ONE_DAY } from '@perawallet/wallet-core-config'
import type { Connection } from '@perawallet/wallet-extension-connections'

/** Milliseconds a session may go without a dApp request before launch ends it. */
export const IDLE_SESSION_TIMEOUT_MS = 90 * ONE_DAY

/**
 * Strict, so exactly the timeout is kept; a `lastActiveAt` ahead of `now`
 * (a clock moved back) is never idle. Both are epoch milliseconds.
 */
export const isIdleSession = (
    connection: Pick<Connection, 'lastActiveAt'>,
    now: number,
): boolean => now - connection.lastActiveAt > IDLE_SESSION_TIMEOUT_MS
