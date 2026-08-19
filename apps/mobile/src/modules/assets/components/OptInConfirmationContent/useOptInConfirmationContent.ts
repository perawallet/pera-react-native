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

import { ALGO_ASSET, toWholeUnits } from '@perawallet/wallet-core-assets'
import { useMinimumFeeConfig } from '@perawallet/wallet-core-blockchain'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'

import type { Decimal } from 'decimal.js'

type UseOptInConfirmationContentResult = {
    /**
     * Fee shown to the user, in ALGO (whole units). Falls back to the
     * remote-config minimum transaction fee when no override is provided.
     */
    resolvedFee: Decimal
}

export const useOptInConfirmationContent = (
    accountAddress: string,
    feeOverride?: Decimal,
): UseOptInConfirmationContentResult => {
    const { minTxnFee } = useMinimumFeeConfig()
    // Sender-aware so a quantum account is quoted the PQ multiple it will
    // actually pay, matching what useAssetOptInMutation builds (PERA-4922).
    const { minFee } = useMinFeeForSender(accountAddress)
    return {
        resolvedFee:
            feeOverride ?? toWholeUnits(minFee ?? minTxnFee, ALGO_ASSET),
    }
}
