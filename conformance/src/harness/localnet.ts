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

import algosdk from 'algosdk'

export const LOCALNET_ALGOD_URL = 'http://localhost:4001'
export const LOCALNET_INDEXER_URL = 'http://localhost:8980'
export const LOCALNET_TOKEN = 'a'.repeat(64)

export type LocalNetInfo = {
    algodVersion: string
    genesisId: string
    genesisHash: string
    lastRound: bigint
}

const UNREACHABLE = [
    'LocalNet is not reachable at ' + LOCALNET_ALGOD_URL + '.',
    '',
    'Start it with:  pnpm localnet',
    'Check status:   pnpm localnet:status',
    '',
    'The conformance suite requires a real node; it cannot run against mocks.',
].join('\n')

export const assertLocalNetReachable = async (): Promise<LocalNetInfo> => {
    // algosdk's client sets `URL.port` from this 3rd arg when it is not `undefined` —
    // passing '' clears the URL's own port (4001 here) back to the protocol default (80).
    const algod = new algosdk.Algodv2(
        LOCALNET_TOKEN,
        LOCALNET_ALGOD_URL,
        undefined,
    )

    try {
        const [versions, status] = await Promise.all([
            algod.versionsCheck().do(),
            algod.status().do(),
        ])
        const build = versions.build

        return {
            algodVersion: `${build.major}.${build.minor}.${build.buildNumber}`,
            genesisId: versions.genesisId,
            genesisHash: Buffer.from(versions.genesisHashB64).toString(
                'base64',
            ),
            lastRound: status.lastRound,
        }
    } catch (error) {
        throw new Error(UNREACHABLE, { cause: error })
    }
}
