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

/** Full path: 44'/283'/{accountIndex}'/0/0 — the device derives internally. */
export const ALGORAND_BIP44_PREFIX = "44'/283'"

/**
 * The `m/` prefix is mandatory: `ledger-algorand-js`'s `serializePath` rejects
 * bare `44'/283'/…` paths with 'Path should start with "m/"'.
 */
export const buildLedgerAccountPath = (accountIndex: number): string =>
    `m/${ALGORAND_BIP44_PREFIX}/${accountIndex}'/0/0`
