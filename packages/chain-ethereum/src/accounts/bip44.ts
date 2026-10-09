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

export const ETHEREUM_COIN_TYPE = 60

export const parseEthereumBip44Path = (hdPath: string): Bip44Coordinates =>
    parseBip44Path(hdPath, ETHEREUM_COIN_TYPE)

export const assertEthereumBip44PathMatches = (
    hdPath: string,
    details: HDWalletDetails,
): void => assertBip44PathMatches(hdPath, details, ETHEREUM_COIN_TYPE)
