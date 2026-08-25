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

/**
 * Waits until the indexer has ingested everything algod has, and explains the
 * one failure that looks like a slow start but never resolves.
 *
 * `algokit localnet start` reports the indexer healthy as soon as its HTTP
 * endpoint answers, which says nothing about whether conduit is ingesting.
 * A cached `algorandfoundation/conduit-localnet` image that predates the
 * running algod cannot decode its blocks at all, so the indexer answers 200
 * and sits at round 0 forever — algod-only suites stay green and only
 * indexer-backed ones fail, several files later, with a timeout that reads
 * like flake.
 */
export const assertIndexerCaughtUp = async (
    timeoutMs = 60_000,
): Promise<bigint> => {
    const algod = new algosdk.Algodv2(
        LOCALNET_TOKEN,
        LOCALNET_ALGOD_URL,
        undefined,
    )
    const deadline = Date.now() + timeoutMs
    let indexerRound = -1n
    let algodRound = 0n

    while (Date.now() < deadline) {
        algodRound = (await algod.status().do()).lastRound

        const response = await fetch(`${LOCALNET_INDEXER_URL}/health`)
        if (response.ok) {
            const health = (await response.json()) as { round?: number }
            indexerRound = BigInt(health.round ?? 0)
            if (indexerRound >= algodRound) return indexerRound
        }

        await new Promise(resolve => setTimeout(resolve, 500))
    }

    throw new Error(
        [
            `The indexer is at round ${indexerRound} but algod is at ${algodRound}, after ${timeoutMs}ms.`,
            '',
            'Check whether conduit is ingesting at all:',
            '  docker logs algokit_sandbox_conduit',
            '',
            'If it reports "unknown protocol ... you need to upgrade" or',
            '"error decoding block", the cached conduit image predates the',
            'running algod and cannot read its blocks. Fix with:',
            '  docker pull algorandfoundation/conduit-localnet:latest',
            '  pnpm localnet:reset',
        ].join('\n'),
    )
}

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
