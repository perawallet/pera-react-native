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

import type { HardwareWalletAppVersion } from '@perawallet/wallet-extension-hardware-wallet'
import type { LedgerAppProfile } from '@perawallet/wallet-extension-ledger-shared'

export const ALGORAND_LEDGER_APP: LedgerAppProfile = {
    appName: 'Algorand',
    // Non-standard; Algorand app v2.0.7+.
    userRejectedStatusCodes: [0x69_86],
}

/**
 * First app version shipping SIGN_ARBITRARY (0x10), required for ARC-60.
 *
 * NOTE: unverified against the Ledger changelog / a physical device. The gate
 * is a UX nicety — if this is too low, the on-device error fallback (mapped to
 * `app_outdated`) is the backstop.
 */
export const ALGORAND_LEDGER_MIN_SIGN_DATA_VERSION: HardwareWalletAppVersion = {
    major: 2,
    minor: 0,
    patch: 0,
}
