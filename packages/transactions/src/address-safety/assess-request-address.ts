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

import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { assessRecipient } from './assess-recipient'
import type {
    AssessRequestAddressInput,
    RequestAddressAssessment,
} from './models'

/**
 * A dApp request's addresses raise only a listed or look-alike warning: dApps
 * call contracts the user has never used all the time, so "never sent to"
 * would fire on nearly every request.
 */
export const assessRequestAddress = ({
    address,
    chainId,
    knownAddresses,
    isListed,
}: AssessRequestAddressInput): RequestAddressAssessment => {
    if (isListed) return { kind: 'listed' }
    if (!addressCodecs.get(chainId).isValid(address)) return { kind: 'clear' }
    const assessment = assessRecipient({
        recipient: address,
        chainId,
        knownAddresses,
    })
    return assessment.kind === 'look-alike' ? assessment : { kind: 'clear' }
}
