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

// TODO(card): remove once Baanx ships the Algorand delegation endpoints (the
// contract in packages/card/src/api/delegation is assumed — see its SWAP
// POINT markers). Dev-only, installed behind `__DEV__` from App.tsx.

/** Base64 of [0x04, 0x81, 0x01] — a plausible tiny program blob. */
const MOCK_PROGRAM = 'BIEB'

let tokenCounter = 0
const issuedTokens = new Set<string>()
const allowanceByAddress = new Map<string, string>()

type MockDelegationToken = { token: string; nonce: string }

/** Fresh single-use pair per call, like `GET /v1/delegation/token`. */
export const buildMockDelegationToken = (): MockDelegationToken => {
    tokenCounter += 1
    const token = `mock-delegation-token-${tokenCounter}`
    issuedTokens.add(token)
    return { token, nonce: `bW9jay1ub25jZS0${tokenCounter}` }
}

export const buildMockDelegationProgram = (): { program: string } => ({
    program: MOCK_PROGRAM,
})

/**
 * Registers/replaces the delegation for an address, enforcing the single-use
 * token. Returns the Baanx-style `{ success }` body (false on a reused token).
 */
export const applyMockDelegation = (body: {
    address: string
    amount: string
    token: string
}): { success: boolean } => {
    if (!issuedTokens.delete(body.token)) {
        return { success: false }
    }
    allowanceByAddress.set(body.address, body.amount)
    return { success: true }
}

type MockExternalWallet = {
    address: string
    currency: string
    balance: string
    allowance: string
    network: string
}

/** Baanx wire shape for `GET /v1/wallet/external`. */
export const buildMockExternalWallets = (): MockExternalWallet[] =>
    [...allowanceByAddress.entries()].map(([address, allowance]) => ({
        address,
        currency: 'usdc',
        balance: '0',
        allowance,
        network: 'algorand',
    }))

export const resetMockDelegation = (): void => {
    tokenCounter = 0
    issuedTokens.clear()
    allowanceByAddress.clear()
}
