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

import { fromPromise } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type {
    AnalyzedSignableGroup,
    SigningResult,
} from '../../../pipeline/types'
import { HardwareWalletError } from '../../../pipeline/errors'

export type LedgerSignerActorInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
}

/**
 * XState actor stub for Ledger hardware wallet signing.
 *
 * TODO: Implement Ledger BLE signing flow:
 *   1. Create an actor from `ledgerSigningMachine`
 *   2. Start the BLE connection + device confirmation flow
 *   3. Resolve with one SigningResult per group once the user confirms on device
 *   4. Reject with HardwareWalletError on BLE failure or timeout
 *
 * See ledgerSigningMachine.ts for the full state machine skeleton.
 */
export const ledgerSignerActor = fromPromise<
    SigningResult[],
    LedgerSignerActorInput
>(async ({ input }) => {
    const firstGroup = input.groups[0]
    throw new HardwareWalletError(
        `Ledger signing is not yet implemented for account ${firstGroup?.signerAddress ?? 'unknown'}`,
    )
})
