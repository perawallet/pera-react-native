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

import { useNativeAsset, toWholeUnits } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useFeeConfig,
    useMinFeeForSender,
} from '@perawallet/wallet-core-signing'

import type { Decimal } from 'decimal.js'

type UseOptOutConfirmationContentResult = {
    /** Fee shown to the user, in the scope's native asset (whole units). */
    fee: Decimal
}

export const useOptOutConfirmationContent = (
    accountAddress: string,
    scope: ChainScope,
): UseOptOutConfirmationContentResult => {
    const nativeAsset = useNativeAsset(scope)
    const { minTxnFee } = useFeeConfig(scope.chainId)
    const { minFee } = useMinFeeForSender(accountAddress, scope.chainId)
    return { fee: toWholeUnits(minFee ?? minTxnFee, nativeAsset) }
}
