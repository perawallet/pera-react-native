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

/**
 * Release gate for the EVM RPC endpoints a build bakes. Reads the same
 * `<CHAIN>_<NETWORK>_RPC_URL` comma lists tools/dev/generate-config.sh does and
 * asks every URL for `eth_chainId`:
 *
 *  - a URL serving another network than the one it is filed under fails, so a
 *    Sepolia node under ETHEREUM_MAINNET_RPC_URL can't ship;
 *  - a URL that can't be reached after three attempts fails a production build,
 *    since a node that is dead at build time would ship dead; elsewhere it only
 *    warns, because the app fails over to the next URL and a public node's
 *    outage shouldn't stop a staging build;
 *  - with APP_ENV=production, every mainnet-tier URL must sit under a domain the
 *    app pins (EVM_RPC_PIN_DOMAINS in packages/chain-ethereum), because a
 *    failed pin on the first URL would otherwise fall over to an unpinned one.
 *
 * URLs are printed without their path or query: a paid provider's API key
 * usually sits there, and this output lands in CI logs.
 *
 *   node tools/check-evm-rpc-endpoints.mjs
 */

import { createRequire } from 'node:module'

const { evmScopeConfigKeys } = createRequire(import.meta.url)(
    './dev/evm-config-keys.cjs',
)

const PIN_DOMAINS = ['perawallet.app']
const ATTEMPTS = 3
const RETRY_DELAY_MS = 1_000
const TIMEOUT_MS = 10_000

const urlsOf = value =>
    (value ?? '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)

const isOnPinnedDomain = host =>
    PIN_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** The chain id a node answers with, retrying only while it can't be reached. */
const fetchChainId = async url => {
    let failure
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_chainId',
                    params: [],
                }),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const { result } = await response.json()
            if (typeof result !== 'string' || !/^0x[0-9a-f]+$/i.test(result)) {
                return {
                    error: `unexpected eth_chainId reply ${JSON.stringify(result)}`,
                }
            }
            return { chainId: BigInt(result) }
        } catch (error) {
            failure = error
            if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS)
        }
    }
    return {
        error: `unreachable after ${ATTEMPTS} attempts: ${failure.message}`,
        isUnreachable: true,
    }
}

/** What a log may show of a URL: no path or query, where a provider's API key lives. */
const shown = url => {
    try {
        return new URL(url).origin
    } catch {
        return '(not a valid URL)'
    }
}

/** `undefined` when the URL checks out; `isUnreachable` marks a failure that says nothing about the network it serves. */
const problemWith = async (url, scope, isProduction) => {
    let parsed
    try {
        parsed = new URL(url)
    } catch {
        return { message: 'not a valid URL' }
    }
    if (isProduction && scope.tier === 'mainnet') {
        if (parsed.protocol !== 'https:' || !isOnPinnedDomain(parsed.hostname)) {
            return {
                message: `a production mainnet endpoint must be https on a pinned domain (${PIN_DOMAINS.join(', ')})`,
            }
        }
    }
    const { chainId, error, isUnreachable } = await fetchChainId(url)
    if (error) return { message: error, isUnreachable }
    if (chainId !== BigInt(scope.eip155ChainId)) {
        return {
            message: `serves chain id ${chainId}, expected ${scope.eip155ChainId}`,
        }
    }
    return undefined
}

const main = async () => {
    const isProduction = process.env.APP_ENV === 'production'
    let checked = 0
    let failed = false

    for (const scope of evmScopeConfigKeys()) {
        for (const url of urlsOf(process.env[scope.rpcUrlEnv])) {
            checked += 1
            const problem = await problemWith(url, scope, isProduction)
            const label = `${scope.rpcUrlEnv} ${shown(url)}`
            if (!problem) {
                console.log(`PASS ${label} — chain id ${scope.eip155ChainId}`)
            } else if (problem.isUnreachable && !isProduction) {
                console.warn(`WARN ${label} — ${problem.message}`)
            } else {
                failed = true
                console.error(`FAIL ${label} — ${problem.message}`)
            }
        }
    }

    if (checked === 0) {
        console.log('No EVM RPC endpoints are set; nothing to check.')
    }
    if (failed) process.exit(1)
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
