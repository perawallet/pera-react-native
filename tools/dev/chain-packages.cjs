// tools/dev/chain-packages.cjs
// The chain packages a build can leave out, and what each one needs from the
// build: the mobile entry modules Metro swaps for their `.stub.ts` twins, and
// the per-network config keys generate-config.sh bakes. packages/config's
// scopeConfigKeys must name the same keys; generate-config.spec pins the two.
//
// Run directly, it prints one line per entry for generate-config.sh:
//   chain <chainId> <CAPABILITIES_ENV> <capabilitiesKey>
//   scope <chainId> <required|optional> <ENV> <key> <package> <field>
// CHAIN_PACKAGES_TABLE swaps the table for a test fixture; generate-config.sh
// refuses it in a production build.

// @ts-check

const path = require('path')

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

const EVM_CHAIN_PACKAGE = '@perawallet/wallet-core-chain-ethereum'

/** @type {readonly ChainPackage[]} */
const CHAIN_PACKAGES = [
    {
        package: EVM_CHAIN_PACKAGE,
        networks: Object.fromEntries(
            Object.entries(
                require('../../packages/chain-contract/src/models/evm-networks.json'),
            ).map(([chainId, { networks }]) => [chainId, networks]),
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
 * Throws on a name the table lacks, so a renamed package fails its callers
 * instead of handing them an empty chain or key list.
 *
 * @param {string} name
 * @param {readonly ChainPackage[]} [packages]
 * @returns {ChainPackage}
 */
const chainPackageNamed = (name, packages = CHAIN_PACKAGES) => {
    const chainPackage = packages.find(entry => entry.package === name)
    if (chainPackage === undefined) {
        throw new Error(`No chain package named ${name} in the table`)
    }
    return chainPackage
}

/**
 * One package's keys for one config field. Throws when there are none, so a
 * renamed field can't turn a check over them into a no-op.
 *
 * @param {string} packageName
 * @param {string} fieldName camelCase
 * @param {readonly ChainPackage[]} [packages]
 * @returns {ChainScopeConfigKey[]}
 */
const chainPackageFieldConfigKeys = (
    packageName,
    fieldName,
    packages = CHAIN_PACKAGES,
) => {
    const keys = chainPackageScopeConfigKeys([
        chainPackageNamed(packageName, packages),
    ]).filter(keys => keys.field === fieldName)
    if (keys.length === 0) {
        throw new Error(`${packageName} bakes no ${fieldName} config key`)
    }
    return keys
}

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
    EVM_CHAIN_PACKAGE,
    chainIdsOf,
    chainPackageCapabilityConfigKeys,
    chainPackageFieldConfigKeys,
    chainPackageNamed,
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
                s.package,
                s.field,
            ].join(' '),
        ),
    ]
    process.stdout.write(`${lines.join('\n')}\n`)
}
