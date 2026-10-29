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

import { ConvertedPreferredAmount } from './ConvertedPreferredAmount'
import { PrecomputedPreferredAmount } from './PrecomputedPreferredAmount'
import type {
    ConvertedPreferredAmountProps,
    PrecomputedPreferredAmountProps,
} from './types'

export type PreferredAmountProps =
    | ConvertedPreferredAmountProps
    | PrecomputedPreferredAmountProps

const isConvertProps = (
    props: PreferredAmountProps,
): props is ConvertedPreferredAmountProps =>
    'sourceAssetId' in props && props.sourceAssetId !== undefined

/**
 * A value in the user's preferred currency (fiat or ALGO). Owns the preferred
 * currency itself — give it either a `sourceAmount` (+ `sourceAssetId`) to
 * convert, or an already-preferred `value` to render directly.
 */
export const PreferredAmount = (props: PreferredAmountProps) =>
    isConvertProps(props) ? (
        <ConvertedPreferredAmount {...props} />
    ) : (
        <PrecomputedPreferredAmount {...props} />
    )
