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

import { useLedgerSigningDriver } from './useLedgerSigningDriver'
import { useLedgerConnectionIssueDriver } from './useLedgerConnectionIssueDriver'

/**
 * The Ledger-only slice of `SigningOverlays`: the on-device progress sheet
 * plus the troubleshooting sheet, and nothing else.
 *
 * Mounted on its own by the approval window (`DappRequestRoutes.web`), which
 * renders its sign request inline via `SignRequestApprovalScreen` rather than
 * through `useSignRequestDriver`'s sheet — mounting the full `SigningOverlays`
 * there would stack a second, duplicate review sheet over that screen, since
 * both the `walletconnect` and `injected` source types are interactive.
 * Without these two drivers the approval window had no hardware-signing UI at
 * all: no "confirm on your Ledger" sheet and, worse, no surface for a
 * connection error, so a failed Ledger sign looked like a stuck spinner.
 */
export const LedgerSigningOverlays = () => {
    useLedgerSigningDriver()
    useLedgerConnectionIssueDriver()

    return null
}
