// tools/dev/chain-packages.cjs
// The chain packages a build can leave out, and what each one needs from the
// build: the mobile entry modules Metro swaps for their `.stub.ts` twins, and
// the per-network config keys generate-config.sh bakes. packages/config's
// scopeConfigKeys must name the same keys; generate-config.spec pins the two.
//
// Run directly, it prints one line per entry for generate-config.sh:
//   chain <chainId> <CAPABILITIES_ENV> <capabilitiesKey>
//   scope <chainId> <required|optional> <ENV> <key>
// CHAIN_PACKAGES_TABLE swaps the table for a test fixture; generate-config.sh
// refuses it in a production build.

// @ts-check

const path = require('path')

const EVM_NETWORKS = require('../../packages/chain-contract/src/models/evm-networks.json')

/**
 * @typedef {{ id: string, tier: string } & Record<string, unknown>} ChainNetworkRow
 * @typedef {{ name: string, isRequired: boolean }} ScopeConfigField
 *   `name` is camelCase. A required field's env must be set in any build whose
 *   CHAINS lists the chain.
 * @typedef {{
 *   package: string,
 *   networks: Readonly<Record<string, readonly ChainNetworkRow[]>>,
 *   mobileStubbedModules: readonly string[],
 *   scopeConfigFields: readonly ScopeConfigField[],
 * }} ChainPackage
 *   `mobileStubbedModules` are relative to apps/mobile, without extension, and
 *   each has a sibling `.stub.ts`.
 * @typedef {{ chainId: string, env: string, key: string }} ChainCapabilityConfigKey
 * @typedef {{
 *   package: string,
 *   chainId: string,
 *   network: ChainNetworkRow,
 *   field: string,
 *   env: string,
 *   key: string,
 *   isRequired: boolean,
 * }} ChainScopeConfigKey
 */

/** @type {readonly ChainPackage[]} */
const CHAIN_PACKAGES = [
    {
        package: '@perawallet/wallet-core-chain-ethereum',
        networks: Object.fromEntries(
            Object.entries(EVM_NETWORKS).map(([chainId, { networks }]) => [
                chainId,
                networks,
            ]),
        ),
        mobileStubbedModules: [
            'src/bootstrap/evm-chain-modules',
            'src/modules/ethereum/chain-ui',
        ],
        scopeConfigFields: [
            { name: 'rpcUrl', isRequired: true },
            { name: 'peraServices', isRequired: false },
        ],
    },
]

/** @param {string} word */
const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1)
/** @param {string} id */
const pascalCase = id => id.split('-').map(capitalize).join('')
/** @param {string} id */
const envName = id => id.toUpperCase().replace(/-/g, '_')
/** @param {string} name camelCase */
const snakeCase = name => name.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()

/**
 * @param {ChainPackage} chainPackage
 * @returns {string[]}
 */
const chainIdsOf = chainPackage => Object.keys(chainPackage.networks)

/**
 * @param {readonly ChainPackage[]} [packages]
 * @returns {ChainCapabilityConfigKey[]}
 */
const chainPackageCapabilityConfigKeys = (packages = CHAIN_PACKAGES) =>
    packages.flatMap(chainPackage =>
        chainIdsOf(chainPackage).map(chainId => ({
            chainId,
            env: `CHAIN_${envName(chainId)}_CAPABILITIES`,
            key: `chain${pascalCase(chainId)}Capabilities`,
        })),
    )

/**
 * @param {readonly ChainPackage[]} [packages]
 * @returns {ChainScopeConfigKey[]}
 */
const chainPackageScopeConfigKeys = (packages = CHAIN_PACKAGES) =>
    packages.flatMap(chainPackage =>
        chainIdsOf(chainPackage).flatMap(chainId =>
            chainPackage.networks[chainId].flatMap(network =>
                chainPackage.scopeConfigFields.map(field => ({
                    package: chainPackage.package,
                    chainId,
                    network,
                    field: field.name,
                    env: `${envName(chainId)}_${envName(network.id)}_${snakeCase(field.name)}`,
                    key: `${chainId}${pascalCase(network.id)}${capitalize(field.name)}`,
                    isRequired: field.isRequired,
                })),
            ),
        ),
    )

/**
 * Throws on a table the build would bake wrong. A hyphenated chain id gets its
 * capability list baked under a key packages/config never reads.
 *
 * @param {readonly ChainPackage[]} packages
 */
const validateChainPackages = packages => {
    /** @type {Map<string, string>} */
    const servedBy = new Map()
    for (const chainPackage of packages) {
        for (const chainId of chainIdsOf(chainPackage)) {
            if (!/^[a-z0-9]+$/.test(chainId)) {
                throw new Error(
                    `${chainPackage.package} serves chain "${chainId}": chain ids must be one lowercase word`,
                )
            }
            const owner = servedBy.get(chainId)
            if (owner !== undefined) {
                throw new Error(
                    `Chain "${chainId}" is served by both ${owner} and ${chainPackage.package}`,
                )
            }
            servedBy.set(chainId, chainPackage.package)
        }
    }
}

module.exports = {
    CHAIN_PACKAGES,
    chainIdsOf,
    chainPackageCapabilityConfigKeys,
    chainPackageScopeConfigKeys,
    validateChainPackages,
}

if (require.main === module) {
    const tablePath = process.env.CHAIN_PACKAGES_TABLE
    /** @type {readonly ChainPackage[]} */
    const packages = tablePath
        ? require(path.resolve(tablePath)).CHAIN_PACKAGES
        : CHAIN_PACKAGES
    validateChainPackages(packages)
    const lines = [
        ...chainPackageCapabilityConfigKeys(packages).map(c =>
            ['chain', c.chainId, c.env, c.key].join(' '),
        ),
        ...chainPackageScopeConfigKeys(packages).map(s =>
            [
                'scope',
                s.chainId,
                s.isRequired ? 'required' : 'optional',
                s.env,
                s.key,
            ].join(' '),
        ),
    ]
    process.stdout.write(`${lines.join('\n')}\n`)
}
