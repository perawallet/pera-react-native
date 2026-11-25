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

import type { Decimal } from 'decimal.js'

/**
 * Balance legs with what left the account first, as every EVM row and detail
 * lists them whichever order the backend or a simulation gives. Stable, so
 * legs moving the same way keep their order.
 */
export const spentFirst = <T extends { value: Decimal }>(
    changes: readonly T[],
): T[] =>
    [...changes].sort(
        (a, b) => Number(b.value.isNegative()) - Number(a.value.isNegative()),
    )
