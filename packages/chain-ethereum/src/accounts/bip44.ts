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
    InvalidBip44PathError,
    type HDWalletDetails,
} from '@perawallet/wallet-core-accounts'

export const ETHEREUM_COIN_TYPE = 60

// `m/` is optional and `h` may stand for `'`, as in Algorand's parser.
const PATH = new RegExp(
    `^(?:m/)?44['h]/${ETHEREUM_COIN_TYPE}['h]/(\\d+)['h]/(\\d+)/(\\d+)$`,
)

/** Throws `InvalidBip44PathError` (`reason: 'malformed'`) for anything but `m/44'/60'/<account>'/<change>/<keyIndex>`. */
export const parseEthereumBip44Path = (
    hdPath: string,
): Pick<HDWalletDetails, 'account' | 'change' | 'keyIndex'> => {
    const match = PATH.exec(hdPath.trim())
    if (!match) {
        throw new InvalidBip44PathError(
            hdPath,
            'malformed',
            `expected m/44'/${ETHEREUM_COIN_TYPE}'/<account>'/<change>/<keyIndex>`,
        )
    }
    const [account, change, keyIndex] = match.slice(1).map(Number)
    return { account, change, keyIndex }
}

export const assertEthereumBip44PathMatches = (
    hdPath: string,
    details: HDWalletDetails,
): void => {
    const parsed = parseEthereumBip44Path(hdPath)
    if (
        parsed.account !== details.account ||
        parsed.change !== details.change ||
        parsed.keyIndex !== details.keyIndex
    ) {
        throw new InvalidBip44PathError(
            hdPath,
            'mismatch',
            `does not match HD wallet (account=${details.account}, change=${details.change}, keyIndex=${details.keyIndex})`,
        )
    }
}
