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
    mnemonicIndexToWord,
    pickDistinctIndexes,
    type MnemonicWordAtPosition,
} from '@perawallet/wallet-core-kms'

const VERIFICATION_WORD_COUNT = 3

/** Positions are picked first and a word resolved for only those — the rest of
 *  the phrase never leaves the index buffer. */
export const pickVerificationPairs = (
    mnemonicIndices: Uint16Array,
): MnemonicWordAtPosition[] =>
    pickDistinctIndexes(VERIFICATION_WORD_COUNT, mnemonicIndices.length).map(
        index => ({
            index,
            word: mnemonicIndexToWord(mnemonicIndices[index]),
        }),
    )
