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

// Dev-only stand-in for AB's escrow service, used only when no escrow base
// URL is configured (see installCardDevMocks). Installed behind `__DEV__`.

type MockApprovalBody = { address: string; transaction: { hash: string } }

/** Serves `POST /api/approvals` the way AB does: echoes the approval record. */
export const buildMockEscrowCardCreation = (body: MockApprovalBody) => ({
    blockchain: 'algorand',
    address: body.address,
    transaction: { hash: body.transaction.hash, blockNumber: null },
    status: 'UNKNOWN',
})

/** Serves `POST /api/internal/delegator-lsig`: echoes the delegator address. */
export const applyMockDelegatorLsig = (body: {
    delegatorAddress: string
}): { delegatorAddress: string } => ({
    delegatorAddress: body.delegatorAddress,
})
