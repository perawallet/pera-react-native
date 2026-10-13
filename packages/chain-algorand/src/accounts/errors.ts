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

import { AccountError } from '@perawallet/wallet-core-accounts'
import { ALGORAND_CHAIN_ID } from '../chain-id'

/** A backup payload named an HD derivation type other than the one Algorand accounts use. */
export class HdDerivationTypeUnsupportedError extends AccountError {
    readonly chainId = ALGORAND_CHAIN_ID

    constructor(derivationType: number) {
        super(
            `HD derivation type ${derivationType} is not supported on ${ALGORAND_CHAIN_ID}`,
            undefined,
            { params: { chainId: ALGORAND_CHAIN_ID } },
        )
    }
}
