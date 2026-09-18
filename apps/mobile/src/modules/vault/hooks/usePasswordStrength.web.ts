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

import { useMemo } from 'react'
import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import * as zxcvbnCommon from '@zxcvbn-ts/language-common'
import * as zxcvbnEn from '@zxcvbn-ts/language-en'

export type PasswordScore = 0 | 1 | 2 | 3 | 4
export type PasswordStrengthError = 'too_short' | 'too_weak'

export const MIN_PASSWORD_LENGTH = 8
// zxcvbn 3 = "safely unguessable" against an offline slow-hash attack, which is
// the threat model for a vault that sits encrypted in extension storage.
export const MIN_PASSWORD_SCORE: PasswordScore = 3

const PRODUCT_TERMS = ['pera', 'perawallet', 'algorand', 'algo', 'wallet']

const zxcvbn = new ZxcvbnFactory({
    dictionary: { ...zxcvbnCommon.dictionary, ...zxcvbnEn.dictionary },
    graphs: zxcvbnCommon.adjacencyGraphs,
})

export const getPasswordScore = (password: string): PasswordScore =>
    zxcvbn.check(password, PRODUCT_TERMS).score

type UsePasswordStrengthResult = {
    score: PasswordScore
    error: PasswordStrengthError | null
}

export const usePasswordStrength = (
    password: string,
): UsePasswordStrengthResult =>
    useMemo(() => {
        const score = getPasswordScore(password)
        const error =
            password.length < MIN_PASSWORD_LENGTH
                ? 'too_short'
                : score < MIN_PASSWORD_SCORE
                  ? 'too_weak'
                  : null
        return { score, error }
    }, [password])
