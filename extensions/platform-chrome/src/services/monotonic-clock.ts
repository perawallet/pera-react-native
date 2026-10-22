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
    MonotonicClockService,
    MonotonicReading,
} from '@perawallet/wallet-extension-platform'

// `performance.now()` restarts with every JS context, so the context's
// `timeOrigin` stands in for a boot id, as the vault lockout does.
export class ChromeMonotonicClockService implements MonotonicClockService {
    now(): MonotonicReading {
        return {
            bootId: String(performance.timeOrigin),
            elapsedMs: performance.now(),
        }
    }
}
