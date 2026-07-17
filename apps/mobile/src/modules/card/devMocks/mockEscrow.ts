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

// TODO(card): remove once AppliedBlockchain ships the escrow card endpoints
// (the contract in packages/card/src/api/escrow is assumed — see its SWAP
// POINT markers). Dev-only, installed behind `__DEV__` from App.tsx.

// One deterministic fake escrow card per funding address, so repeated
// creation calls for the same account return the same card (matches the
// resume/reuse path).
const cardByAddress = new Map<string, string>()

const fakeCardAddress = (fundingAddress: string): string => {
    const suffix = fundingAddress.slice(0, 8).toUpperCase()
    return `MOCKESCROWCARD${suffix}`.padEnd(58, 'A').slice(0, 58)
}

/** Serves `POST /api/approvals` — returns the created escrow card address. */
export const buildMockEscrowCardCreation = (body: {
    address: string
}): { cardAddress: string } => {
    const existing = cardByAddress.get(body.address)
    if (existing) {
        return { cardAddress: existing }
    }
    const cardAddress = fakeCardAddress(body.address)
    cardByAddress.set(body.address, cardAddress)
    return { cardAddress }
}

/** Serves `POST /api/internal/delegator-lsig` — echoes the delegator address. */
export const applyMockDelegatorLsig = (body: {
    delegatorAddress: string
}): { delegatorAddress: string } => ({
    delegatorAddress: body.delegatorAddress,
})

export const resetMockEscrow = (): void => {
    cardByAddress.clear()
}
