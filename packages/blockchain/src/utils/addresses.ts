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

import {
    encodeAddress,
    decodeAddress,
    ALGORAND_ZERO_ADDRESS_STRING,
} from 'algosdk'

export const encodeAlgorandAddress = (bytes: Uint8Array): string => {
    return encodeAddress(bytes)
}

/**
 * True when an address slot is unset. An ASA role the creator never assigned
 * (freeze, clawback, manager, reserve) reads back as either an absent field or
 * the zero address, depending on the node — treat both as "no role".
 */
export const isZeroAddress = (address?: string): boolean =>
    !address || address === ALGORAND_ZERO_ADDRESS_STRING

export const isValidAlgorandAddress = (address?: string): boolean => {
    if (!address) return false
    try {
        decodeAddress(address)
        return true
    } catch {
        return false
    }
}
