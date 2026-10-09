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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { waitForConfirmation } from 'algosdk'

export const CONFIRMATION_ROUNDS_TO_WAIT = 10

/**
 * Post-error verification window. Kept deliberately smaller than the main
 * confirmation wait: a transaction that reached the pool confirms within a
 * couple of rounds, and the whole submit + verify chain must finish inside
 * the signing machine's SUBMIT_TIMEOUT backstop.
 */
export const LANDING_CHECK_ROUNDS_TO_WAIT = 4

export const waitForAlgodConfirmation = async (
    algorand: AlgorandClient,
    txId: string,
    waitRounds: number,
): Promise<void> => {
    await waitForConfirmation(algorand.client.algod, txId, waitRounds)
}
