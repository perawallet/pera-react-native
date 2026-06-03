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

import { toEnumValue } from '@perawallet/wallet-core-shared'
import { CardStatus, CardType, type Card } from '../../models'
import type { CardStatusApiResponse } from './schema'

export const transformCard = (response: CardStatusApiResponse): Card => ({
    id: response.id,
    holderName: response.holderName,
    expiryDate: response.expiryDate,
    panLast4: response.panLast4,
    // Unknown status falls back to Blocked — fail safe, never show an active
    // card we don't recognise.
    status: toEnumValue(CardStatus, response.status, CardStatus.Blocked),
    type: toEnumValue(CardType, response.type, CardType.Virtual),
    orderedAt: response.orderedAt,
})
