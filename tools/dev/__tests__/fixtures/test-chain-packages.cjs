// A chain package table holding one package no build ships, for the Metro gate
// spec and for the specs that point generate-config.sh at it through
// CHAIN_PACKAGES_TABLE.

module.exports = {
    CHAIN_PACKAGES: [
        {
            package: '@perawallet/wallet-core-chain-testchain',
            networks: {
                testchain: [
                    { id: 'mainnet', tier: 'mainnet' },
                    { id: 'devnet', tier: 'testnet' },
                ],
            },
            mobileStubbedModules: ['src/testchain/entry'],
            scopeConfigFields: [
                { name: 'rpcUrl', isRequired: true },
                { name: 'peraServices', isRequired: false },
            ],
        },
    ],
}
