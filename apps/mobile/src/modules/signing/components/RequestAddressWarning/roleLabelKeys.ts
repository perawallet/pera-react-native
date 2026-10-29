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

import type { ReviewedAddressRole } from '@perawallet/wallet-core-signing'

export const ROLE_LABEL_KEYS = {
    recipient: 'signing.address_safety.role.recipient',
    'token-recipient': 'signing.address_safety.role.token_recipient',
    'close-recipient': 'signing.address_safety.role.close_recipient',
    'new-authorizer': 'signing.address_safety.role.new_authorizer',
    'referenced-account': 'signing.address_safety.role.referenced_account',
    target: 'signing.address_safety.role.target',
    spender: 'signing.address_safety.role.spender',
    operator: 'signing.address_safety.role.operator',
} as const satisfies Record<ReviewedAddressRole, string>
