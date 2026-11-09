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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'

/** A mined approve row can't tell a revocation from a grant; the node read can. */
export const REVOKE_APPROVAL_TITLE_KEY = i18nKey(
    'transactions.list_item.revoke_approval',
)

/** The node read's title for a call it names no action for. */
export const CONTRACT_CALL_TITLE_KEY = i18nKey(
    'transactions.list_item.contract_call',
)
