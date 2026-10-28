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

import type { KnownAddress } from '@perawallet/wallet-core-transactions'

export const KNOWN_LABEL_KEYS = {
    'own-account':
        'send_funds.recipient_safety.look_alike_known_label_own_account',
    'watched-account':
        'send_funds.recipient_safety.look_alike_known_label_watched_account',
    contact: 'send_funds.recipient_safety.look_alike_known_label_contact',
    history: 'send_funds.recipient_safety.look_alike_known_label_history',
} as const satisfies Record<KnownAddress['source'], string>
