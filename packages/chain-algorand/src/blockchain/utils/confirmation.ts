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

import { waitForConfirmation, type Algodv2 } from 'algosdk'

/** Rounds to poll before giving up; a pooled transaction lands within a few. */
export const CONFIRMATION_ROUNDS_TO_WAIT = 10

/**
 * Resolves once `txId` is in a block. The submit helpers return at pool
 * acceptance, so a flow that re-reads chain state straight after submitting
 * has to wait here first or it reads the pre-transaction state.
 */
export const waitForTransactionConfirmation = async (
    algod: Algodv2,
    txId: string,
    rounds: number = CONFIRMATION_ROUNDS_TO_WAIT,
): Promise<void> => {
    await waitForConfirmation(algod, txId, rounds)
}
