/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCardStore } from '@perawallet/wallet-core-card'

const PAN_MASK = '••••'

type UsePeraCardDetailsResult = {
    /** Masked PAN for the card visual, e.g. "•••• 2234". */
    maskedPan: string
}

export const usePeraCardDetails = (): UsePeraCardDetailsResult => {
    const panLast4 = useCardStore(state => state.lastKnownPanLast4)

    return {
        maskedPan: `${PAN_MASK} ${panLast4 ?? PAN_MASK}`,
    }
}
