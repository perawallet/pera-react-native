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
import type {
    AssessRecipientInput,
    KnownAddressSource,
    RecipientAssessment,
} from './models'

const LOOK_ALIKE_PRIORITY: readonly KnownAddressSource[] = [
    'own-account',
    'watched-account',
    'contact',
    'history',
]

export const assessRecipient = ({
    recipient,
    chainId,
    knownAddresses,
}: AssessRecipientInput): RecipientAssessment => {
    const codec = addressCodecs.get(chainId)

    const matches = knownAddresses.filter(known =>
        codec.areEqual(known.address, recipient),
    )
    const vouchedMatch = matches.find(known => !known.isInboundOnly)
    if (vouchedMatch) return { kind: 'known', source: vouchedMatch.source }

    // Paying the account is all an inbound-only match proves, which a poisoner
    // can afford, so it doesn't outweigh resembling an address the user vouched for.
    const candidates =
        matches.length > 0
            ? knownAddresses.filter(known => !known.isInboundOnly)
            : knownAddresses
    for (const source of LOOK_ALIKE_PRIORITY) {
        const lookAlike = candidates.find(
            known =>
                known.source === source &&
                codec.resembles(recipient, known.address),
        )
        if (lookAlike) return { kind: 'look-alike', knownAddress: lookAlike }
    }

    if (matches[0]) return { kind: 'known', source: matches[0].source }
    return { kind: 'first-send' }
}
