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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { isLedgerAccount } from '@perawallet/wallet-core-accounts'
import type {
    SigningStrategy,
    AnalyzedSignableGroup,
    SigningResult,
    SigningCallbacks,
} from '../types'
import { CannotSignError, HardwareWalletError } from '../errors'

/**
 * Creates a signing strategy for hardware wallets (Ledger).
 * These accounts require device interaction with user prompts.
 *
 * TODO: Implement actual Ledger transport integration
 */
export const createHardwareStrategy = (): SigningStrategy => {
    return {
        canSign: (account: WalletAccount): boolean => {
            return isLedgerAccount(account)
        },

        sign: async (
            _group: AnalyzedSignableGroup,
            account: WalletAccount,
            _callbacks?: SigningCallbacks,
        ): Promise<SigningResult> => {
            // Validate that this is a hardware wallet account
            if (!isLedgerAccount(account)) {
                throw new CannotSignError(
                    account.address,
                    'Account is not a hardware wallet',
                )
            }

            // TODO: Implement actual hardware wallet signing
            // This will involve:
            // 1. Connecting to the Ledger device
            // 2. Emitting onHardwarePrompt callbacks for user interaction
            // 3. Signing each transaction on the device
            // 4. Returning the signed transactions

            throw new HardwareWalletError(
                'Hardware wallet signing is not yet implemented',
            )
        },
    }
}
