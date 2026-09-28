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

/**
 * Build gate for the AutoDraw LogicSig template. The user signs a program
 * compiled from `packages/chain-algorand/src/card/escrow/autodraw-teal.ts`, and once
 * signed it cannot be revoked, so the template shipped in a release must be
 * the one whose SHA-256 is pinned in Bitrise (`CARD_AUTODRAW_TEMPLATE_HASH`).
 * The app repeats this check before signing; running it here turns a
 * forgotten pin update into a failed build instead of a failed signing.
 *
 * The expected value is read from the GENERATED config, not the shell, so
 * what is checked is exactly what gets bundled. An empty pin fails only when
 * the generated appEnvironment is staging or production; CI builds without
 * secrets (development) warn and pass.
 *
 *   pnpm check:autodraw-hash
 *   pnpm check:autodraw-hash --print
 *
 * `--print` prints the template hash and, for every network whose app ids are
 * in the generated config, the compiled-program hash for that network's
 * `*_CARD_AUTODRAW_PROGRAM_HASH` pin. Run it whenever the TEAL changes or a
 * card app is redeployed, and paste the output into Bitrise.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE_PATH = join(
    ROOT,
    'packages/chain-algorand/src/card/escrow/autodraw-teal.ts',
)
const GENERATED_ENV_PATH = join(ROOT, 'packages/config/src/generated-env.ts')

// Public network constants. algod's compile endpoint is stateless, so any
// public node returns the same bytes as the app's configured node.
const NETWORKS = {
    mainnet: {
        algodUrl: 'https://mainnet-api.algonode.cloud',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        mainAppKey: 'mainnetCardW3CardAppId',
        killswitchAppKey: 'mainnetCardKillswitchAppId',
        pinName: 'MAINNET_CARD_AUTODRAW_PROGRAM_HASH',
    },
    testnet: {
        algodUrl: 'https://testnet-api.algonode.cloud',
        genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        mainAppKey: 'testnetCardW3CardAppId',
        killswitchAppKey: 'testnetCardKillswitchAppId',
        pinName: 'TESTNET_CARD_AUTODRAW_PROGRAM_HASH',
    },
}

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** Parses the `key: "value",` lines generate-config.sh emits. */
const readGeneratedEnv = () => {
    if (!existsSync(GENERATED_ENV_PATH)) {
        throw new Error(
            `${GENERATED_ENV_PATH} is missing; run \`pnpm generate:config\` first`,
        )
    }
    const env = {}
    const line = /^\s*(\w+):\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm
    const source = readFileSync(GENERATED_ENV_PATH, 'utf8')
    for (const match of source.matchAll(line)) {
        env[match[1]] = JSON.parse(match[2])
    }
    return env
}

// Imported as TypeScript on purpose: the file has no imports, so Node's type
// stripping handles it, and the hash comes from the exact bytes the app
// bundles rather than from a build artifact that may be stale.
const loadTemplate = () => import(pathToFileURL(TEMPLATE_PATH).href)

const compileProgramHash = async (teal, algodUrl) => {
    const response = await fetch(`${algodUrl}/v2/teal/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: teal,
    })
    if (!response.ok) {
        throw new Error(`${algodUrl} compile failed: HTTP ${response.status}`)
    }
    const { result } = await response.json()
    return sha256Hex(Buffer.from(result, 'base64'))
}

const printPins = async (env, template, templateHash) => {
    console.log(`CARD_AUTODRAW_TEMPLATE_HASH=${templateHash}`)
    for (const [network, cfg] of Object.entries(NETWORKS)) {
        const mainAppId = env[cfg.mainAppKey]
        const killswitchAppId = env[cfg.killswitchAppKey]
        if (!mainAppId || !killswitchAppId) {
            console.log(
                `# ${network}: app ids not in generated config, skipping`,
            )
            continue
        }
        const genesisHex = `0x${Buffer.from(cfg.genesisHash, 'base64').toString('hex')}`
        const teal = template.AUTODRAW_TEAL_TEMPLATE.replaceAll(
            template.TMPL_KILLSWITCH_APP,
            killswitchAppId,
        )
            .replaceAll(template.TMPL_MAIN_APP, mainAppId)
            .replaceAll(template.TMPL_GENESIS_HASH, genesisHex)
        const programHash = await compileProgramHash(teal, cfg.algodUrl)
        console.log(`${cfg.pinName}=${programHash}`)
    }
}

const main = async () => {
    const env = readGeneratedEnv()
    const template = await loadTemplate()
    const actual = sha256Hex(
        new TextEncoder().encode(template.AUTODRAW_TEAL_TEMPLATE),
    )

    if (process.argv.includes('--print')) {
        await printPins(env, template, actual)
        return
    }

    const expected = (env.cardAutoDrawTemplateHash ?? '')
        .trim()
        .toLowerCase()
    const appEnvironment = env.appEnvironment ?? 'development'

    if (!expected) {
        const message = `CARD_AUTODRAW_TEMPLATE_HASH is not set (appEnvironment=${appEnvironment}); AutoDraw will fail closed in this build`
        if (appEnvironment === 'staging' || appEnvironment === 'production') {
            throw new Error(message)
        }
        console.warn(`WARN: ${message}`)
        return
    }

    if (expected !== actual) {
        throw new Error(
            [
                'AutoDraw TEAL template hash mismatch',
                `  pinned: ${expected}`,
                `  actual: ${actual}`,
                'If the template change is intentional, run `pnpm check:autodraw-hash --print` and update the Bitrise secrets.',
            ].join('\n'),
        )
    }
    console.log(`✓ AutoDraw TEAL template matches its pin (${actual})`)
}

main().catch((error) => {
    console.error(`ERROR: ${error.message}`)
    process.exit(1)
})
