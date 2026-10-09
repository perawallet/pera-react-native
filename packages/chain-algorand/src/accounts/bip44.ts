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
    assertBip44PathMatches,
    parseBip44Path,
    type Bip44Coordinates,
    type HDWalletDetails,
} from '@perawallet/wallet-core-accounts'

/** Algorand's SLIP-0044 coin type. */
export const ALGORAND_COIN_TYPE = 283

export type ParsedAlgorandBip44Path = Bip44Coordinates

export const parseAlgorandBip44Path = (
    hdPath: string,
): ParsedAlgorandBip44Path => parseBip44Path(hdPath, ALGORAND_COIN_TYPE)

/** Throws `InvalidBip44PathError` (`reason: 'malformed'`) when the path doesn't parse; a mismatch returns false. */
export const hdPathMatchesDetails = (
    path: string,
    details: HDWalletDetails,
): boolean => {
    const parsed = parseAlgorandBip44Path(path)
    return (
        parsed.account === details.account &&
        parsed.change === details.change &&
        parsed.keyIndex === details.keyIndex
    )
}

export const assertAlgorandBip44PathMatches = (
    path: string,
    details: HDWalletDetails,
): void => assertBip44PathMatches(path, details, ALGORAND_COIN_TYPE)
