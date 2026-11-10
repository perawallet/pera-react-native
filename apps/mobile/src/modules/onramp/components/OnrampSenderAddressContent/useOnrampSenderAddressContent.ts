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

import { useCallback, useState } from 'react'
import {
    isPlausibleRampSenderAddress,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { sourceNetworkLabelOf } from '../OnrampForm/onrampFormHelpers'

type UseOnrampSenderAddressContentParams = {
    initialAddress: string
    /** The pay asset; the address must be an account on its chain. */
    sourceToken: RampToken
}

export type UseOnrampSenderAddressContentResult = {
    address: string
    setAddress: (value: string) => void
    clearAddress: () => void
    /** The source's chain, for the placeholder and the error. */
    networkLabel: string
    isValid: boolean
    /** An entry that can't be an address on the source's chain; empty is fine. */
    hasError: boolean
    handleConfirm: () => void
}

export const useOnrampSenderAddressContent = ({
    initialAddress,
    sourceToken,
}: UseOnrampSenderAddressContentParams): UseOnrampSenderAddressContentResult => {
    const { resolve } = useBottomSheetResult<string>()
    const [address, setAddress] = useState(initialAddress)

    const isValid = isPlausibleRampSenderAddress(sourceToken, address)
    const hasError = address.trim() !== '' && !isValid

    const clearAddress = useCallback(() => setAddress(''), [])

    const handleConfirm = useCallback(() => {
        if (isValid) resolve(address.trim())
    }, [address, isValid, resolve])

    return {
        address,
        setAddress,
        clearAddress,
        networkLabel: sourceNetworkLabelOf(sourceToken),
        isValid,
        hasError,
        handleConfirm,
    }
}
