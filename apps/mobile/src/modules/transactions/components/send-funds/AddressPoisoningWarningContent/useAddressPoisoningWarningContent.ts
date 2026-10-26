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

import { useMemo, useState } from 'react'
import {
    diffAddressCharacters,
    type AddressPoisoningRisk,
    type AddressSegment,
} from '@perawallet/wallet-core-transactions'
import type { Optional } from '@perawallet/wallet-core-shared'

type UseAddressPoisoningWarningContentParams = {
    recipient: string
    risk: AddressPoisoningRisk
}

type UseAddressPoisoningWarningContentResult = {
    isAcknowledged: boolean
    setIsAcknowledged: (value: boolean) => void
    recipientSegments: AddressSegment[]
    similarToSegments: Optional<AddressSegment[]>
}

export const useAddressPoisoningWarningContent = ({
    recipient,
    risk,
}: UseAddressPoisoningWarningContentParams): UseAddressPoisoningWarningContentResult => {
    const [isAcknowledged, setIsAcknowledged] = useState(false)

    const similarTo = risk.kind === 'lookalike' ? risk.similarTo : undefined
    const recipientSegments = useMemo(
        () =>
            similarTo
                ? diffAddressCharacters(recipient, similarTo)
                : [{ text: recipient, isDifferent: false }],
        [recipient, similarTo],
    )
    const similarToSegments = useMemo(
        () =>
            similarTo ? diffAddressCharacters(similarTo, recipient) : undefined,
        [recipient, similarTo],
    )

    return {
        isAcknowledged,
        setIsAcknowledged,
        recipientSegments,
        similarToSegments,
    }
}
