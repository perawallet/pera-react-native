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

import { DerivationTypes } from '@perawallet/wallet-core-accounts'

// New HD accounts derive with Peikert; the key derivation and the adapter's
// `hdDerivationType` must agree, or the stored details name the wrong key.
export const ALGORAND_HD_DERIVATION_TYPE = DerivationTypes.Peikert

// Max holdings per indexer page; the split account read and the opt-in-rounds
// read share it.
export const HOLDINGS_PAGE_LIMIT = 1000
