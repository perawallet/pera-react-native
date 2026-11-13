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

// The viem-bound pieces of the approvals integration flow, which the app's
// specs can't import themselves.
import {
    decodeFunctionData,
    erc20Abi,
    erc721Abi,
    getAddress,
    maxUint256,
    parseTransaction,
    type Hex,
} from 'viem'

// Hardhat account #0, from the public test mnemonic.
export const APPROVAL_OWNER = getAddress(
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
)

export const APPROVAL_USDC = getAddress(
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
)
export const APPROVAL_DAI = getAddress(
    '0x6B175474E89094C44Da98b954EedeAC495271d0F',
)
export const APPROVAL_APES = getAddress(
    '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
)
export const APPROVAL_ROUTER = getAddress(
    '0xE592427A0AEce92De3Edee1F18E0157C05861564',
)
export const APPROVAL_SEAPORT = getAddress(
    '0x1E0049783F008A0085193E00003D00cd54003c71',
)
export const MAX_UINT256 = maxUint256

// Signatures Hardhat #0 made over the exact digests the flow signs. The
// package may not import a signing library, so they are fixtures: a changed
// fee, nonce or call changes a digest and needs a new one.
const OWNER_SIGNATURES: Record<string, string> = {
    // approve(spender, 0)
    '368eba7e2187d176e6edbf9f437a3be222ca6a4e050e0fa3843fba3b2551ff26':
        'b65fd46aa3e35c14b9a065eed30997f2219c0a081e5e53a9c56c1fe1c2e37d0c25ae8eac0b6e13fb7f210467d738a3c90afdc879005c97088ae561982e8acfb401',
    // setApprovalForAll(operator, false)
    e79045683635f0c4f03f08cb0552ff5b2a388b26afa10245e7baa039906f952f:
        '374b0c5f90d51e5d557c6b0502d1c13949a5468cf48c68eed5fdb441df7e4de34a2a909ba6efde42224d7e7653d862396d3493405a87b9d2af4d811ee8e6dad701',
}

export const signWithOwnerKey = async (
    _keyPairId: string,
    digest: Uint8Array,
): Promise<Uint8Array> => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = OWNER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

export type SentRevoke = {
    /** Lowercase, as a parsed transaction reports it. */
    to: string
    functionName: 'approve' | 'setApprovalForAll'
    args: readonly unknown[]
}

/** What a raw transaction the node received calls, when it is one of the two revokes. */
export const readSentRevoke = (raw: string): SentRevoke => {
    const { to, data } = parseTransaction(raw as Hex)
    if (!to || !data) throw new Error('Not a contract call')
    try {
        const read = decodeFunctionData({ abi: erc20Abi, data })
        if (read.functionName === 'approve') {
            return { to, functionName: 'approve', args: read.args }
        }
    } catch {
        // Not an ERC-20 call; read it as the collection one below.
    }
    const read = decodeFunctionData({ abi: erc721Abi, data })
    if (read.functionName !== 'setApprovalForAll') {
        throw new Error(`Not a revoke: ${read.functionName}`)
    }
    return { to, functionName: 'setApprovalForAll', args: read.args }
}
