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

// Hardhat #0 over the send each chain's flow signs, one per chain: the
// package may not import a signing library. A changed fee, nonce or call
// changes a digest and needs a new one.
const SENDER_SIGNATURES: Record<string, string> = {
    // Polygon
    '66460764a760d840d6dcf0bf8b8f6f6d4f7b32bc27338d71db5c1351b0880653':
        'e6baa0195960117c9cc0755e5a2e98a037ea816bbc03bad9c7bffb7fde010b9b36a261eb635c8302590e2398aa931a517fd96035eabeb7ab2ba07288451cc0cf01',
    // Base
    '232dbdbdad891207b673f6e537ef4d40baa52cfe715582382345ff2808ac9d2a':
        '13df4d1a3c208afa693012e13e2fd486a55994250d5f5896498f621ad6925cc30aede8363e0829be8c000deedf4c939b57aed4966df47be8194254ecc9afc0fb00',
    // Arbitrum One
    d0c5f1d972c870fb9fa5230d147f4b9ba6feb2744d48c16a3e859b684961f0f5:
        '9f86d87ab3c1dc2a22bb88849101bcef53ea0fe36fe1cf32c8fa6e62e5b2426951021286156bf30b179ed62c606eac9bdbe225a61068f20964eb2825d4dca27301',
    // Optimism
    '0699ae58d452d71fef67d773b0e9a06b10211c2f9c6eb8afba0d1f0d6f1f003b':
        '8689048cceda32d91f52e0f577e3174993dd8e9988a9e4c2ee06864828d8a57d2ef8e47bf4ffb34aaa829f355a56fadd41453f6ab503e4dd712a25b457d1b27f01',
    // BNB Chain
    f2b6e21ac040f3d588ac9147d38c083613dbf4e1ba7dac5f149dab496f387993:
        'fc7058c6258dccf0268627849496bcc19aec60c131268a927f6c4ce1baca6f2571055eb992baf6e1560057565bfd625dd5c89a5121b67676e4a42a44fbc4738400',
    // Avalanche C-Chain
    '023f54934e60383860bcd03f4671c77fbabcd87a740dab1afa123e486f169900':
        'ef70e8d412231b0565dd84ce6caa9bc48b029e46baca0c07acac8fa905af530057e35cb4be6979087177c8a8fd1e7a172ed0db8237bc1feaa17011f339728c9801',
}

export const signWithSenderOnChains = async (
    _keyPairId: string,
    digest: Uint8Array,
): Promise<Uint8Array> => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = SENDER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}
