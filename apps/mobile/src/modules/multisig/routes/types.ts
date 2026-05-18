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

/**
 * Params passed to `NameMultisig` when naming an imported shared account
 * (scanned via QR) rather than one built through the in-app creation flow.
 * When absent, `NameMultisig` reads the participants/threshold from the
 * multisig creation store instead.
 */
export type NameMultisigImportParams = {
    address: string
    threshold: number
    addresses: string[]
    version: number
}

export type MultisigStackParamList = {
    CreateMultisig: undefined
    EditParticipant: { address: string }
    SetThreshold: undefined
    NameMultisig: NameMultisigImportParams | undefined
    ImportSharedAccount: { address: string }
}
