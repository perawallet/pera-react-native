// tools/dev/evm-config-keys.cjs
// The env vars and config keys of every EVM chain and network, read from the
// network table the app registers. packages/config's evmConfigKeys must name
// the same keys; generate-config.spec pins the two.
//
// Run directly, it prints one line per entry for generate-config.sh:
//   chain <chainId> <CAPABILITIES_ENV> <capabilitiesKey>
//   scope <chainId> <RPC_URL_ENV> <rpcUrlKey> <PERA_SERVICES_ENV> <peraServicesKey>

const EVM_NETWORKS = require('../../packages/chain-contract/src/models/evm-networks.json')

const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1)
const pascalCase = id => id.split('-').map(capitalize).join('')
const envName = id => id.toUpperCase().replace(/-/g, '_')

const EVM_CHAIN_IDS = Object.keys(EVM_NETWORKS)

const evmChainConfigKeys = () =>
    EVM_CHAIN_IDS.map(chainId => ({
        chainId,
        capabilitiesEnv: `CHAIN_${envName(chainId)}_CAPABILITIES`,
        capabilitiesKey: `chain${pascalCase(chainId)}Capabilities`,
    }))

const evmScopeConfigKeys = () =>
    EVM_CHAIN_IDS.flatMap(chainId =>
        EVM_NETWORKS[chainId].networks.map(({ id: networkId }) => {
            const key = `${chainId}${pascalCase(networkId)}`
            const env = `${envName(chainId)}_${envName(networkId)}`
            return {
                chainId,
                networkId,
                rpcUrlEnv: `${env}_RPC_URL`,
                rpcUrlKey: `${key}RpcUrl`,
                peraServicesEnv: `${env}_PERA_SERVICES`,
                peraServicesKey: `${key}PeraServices`,
            }
        }),
    )

module.exports = { EVM_CHAIN_IDS, evmChainConfigKeys, evmScopeConfigKeys }

if (require.main === module) {
    const lines = [
        ...evmChainConfigKeys().map(c =>
            ['chain', c.chainId, c.capabilitiesEnv, c.capabilitiesKey].join(' '),
        ),
        ...evmScopeConfigKeys().map(s =>
            [
                'scope',
                s.chainId,
                s.rpcUrlEnv,
                s.rpcUrlKey,
                s.peraServicesEnv,
                s.peraServicesKey,
            ].join(' '),
        ),
    ]
    process.stdout.write(`${lines.join('\n')}\n`)
}
