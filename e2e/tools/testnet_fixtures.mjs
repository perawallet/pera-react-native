#!/usr/bin/env node
// Creates and funds the Algorand testnet wallets the needs-funded cases read (README, "Funded
// fixtures"), using the app's own derivation so every address matches what the app shows.
//
//   node e2e/tools/testnet_fixtures.mjs generate <env file>   new wallets; prints addresses only
//   node e2e/tools/testnet_fixtures.mjs fund <env file>       after the treasury is funded
//   node e2e/tools/testnet_fixtures.mjs pay <address> <microAlgos>    from MNEMONIC_25_WORD
//   node e2e/tools/testnet_fixtures.mjs address-of-env <VAR>  universal address of a phrase
//
// The env file holds recovery phrases: it is written mode 600 and belongs outside the repo.
// `fund` only ever talks to testnet, and is safe to rerun: funded accounts and finished rekeys
// are skipped.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const TESTNET_ALGOD = 'https://testnet-api.algonode.cloud'
const MICRO = 1_000_000n
const ACCOUNT_RESERVE = 200_000n // the 0.1 ALGO minimum balance plus room for fees

// The packages are workspace dependencies, not the e2e tooling's, so they load from where
// pnpm installed them for the app's chain packages.
const load = async (pkgDir, name, subpath = '.') => {
    const dir = join(ROOT, pkgDir, 'node_modules', name)
    const { exports, module, main } = JSON.parse(
        readFileSync(join(dir, 'package.json'), 'utf8'),
    )
    const entry = exports?.[subpath]
    const file =
        typeof entry === 'string'
            ? entry
            : (entry?.import?.default ??
              entry?.import ??
              entry?.default ??
              (subpath === '.' ? (module ?? main) : subpath))
    return import(pathToFileURL(join(dir, file)).href)
}

const algosdk = (await load('packages/chain-algorand', 'algosdk')).default
const { generateMnemonic, mnemonicToSeed } = await load(
    'packages/chain-algorand',
    '@scure/bip39',
)
const { wordlist } = await load(
    'packages/chain-algorand',
    '@scure/bip39',
    './wordlists/english.js',
)
const xhd = await load(
    'packages/chain-algorand',
    '@algorandfoundation/xhd-wallet-api',
)
const { mnemonicToAccount } = await load(
    'packages/chain-ethereum',
    'viem',
    './accounts',
)

// Every Pera HD account derives with Peikert at m/44'/283'/<account>'/0/<index>.
const universalAddress = async (mnemonic, account = 0) => {
    const rootKey = xhd.fromSeed(Buffer.from(await mnemonicToSeed(mnemonic)))
    const publicKey = await new xhd.XHDWalletAPI().keyGen(
        rootKey,
        xhd.KeyContext.Address,
        account,
        0,
        xhd.BIP32DerivationType.Peikert,
    )
    return algosdk.encodeAddress(publicKey)
}

// Published in the app's own derivation test (xhd-derivation.spec.ts); never fund it.
const PARITY = {
    mnemonic:
        'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street',
    address: 'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A',
}

const checkDerivation = async () => {
    const derived = await universalAddress(PARITY.mnemonic)
    if (derived !== PARITY.address) {
        throw new Error(
            `Derivation does not match the app's parity vector: ${derived}`,
        )
    }
}

const newUniversal = async () => {
    const mnemonic = generateMnemonic(wordlist, 256)
    return { mnemonic, address: await universalAddress(mnemonic) }
}

const newAlgo25 = () => {
    const account = algosdk.generateAccount()
    return {
        mnemonic: algosdk.secretKeyToMnemonic(account.sk),
        address: account.addr.toString(),
    }
}

const generate = async file => {
    if (existsSync(file))
        throw new Error(`${file} exists; delete it first or run fund.`)
    await checkDerivation()
    const treasury = newAlgo25()
    const funded = await newUniversal()
    const twentyFour = await newUniversal()
    const rekeyedWallet = await newUniversal()
    const rekeyedIntoWallet = newAlgo25()
    const rekeyAuth = newAlgo25()
    const rekeyedIntoAuth = newAlgo25()
    const env = {
        // The treasury doubles as the funded algo25 fixture the onboarding cases import.
        MNEMONIC_25_WORD: treasury.mnemonic,
        E2E_FUNDED_MNEMONIC: funded.mnemonic,
        E2E_FUNDED_ADDRESS: funded.address,
        E2E_ETHEREUM_FUNDED_MNEMONIC: funded.mnemonic,
        MNEMONIC_24_WORD: twentyFour.mnemonic,
        MNEMONIC_24_REKEYED_ACCOUNT: rekeyedWallet.mnemonic,
        E2E_FIXTURE_REKEYED_INTO_WALLET_MNEMONIC: rekeyedIntoWallet.mnemonic,
        E2E_REKEY_AUTH_MNEMONIC: rekeyAuth.mnemonic,
        E2E_REKEY_AUTH_ADDRESS: rekeyAuth.address,
        E2E_REKEYED_ADDRESS: rekeyedIntoAuth.address,
        E2E_FIXTURE_REKEYED_INTO_AUTH_MNEMONIC: rekeyedIntoAuth.mnemonic,
    }
    const body = Object.entries(env)
        .map(([name, value]) => `${name}='${value}'`)
        .join('\n')
    writeFileSync(file, `${body}\n`, { mode: 0o600 })
    console.log(`Wrote ${file} (mode 600).`)
    console.log(`Fund the treasury with 10 testnet ALGO: ${treasury.address}`)
    console.log(
        `Fund with Sepolia ETH for the Ethereum send case: ${mnemonicToAccount(funded.mnemonic).address}`,
    )
}

const readEnv = file =>
    Object.fromEntries(
        readFileSync(file, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map(line => line.match(/^([A-Z0-9_]+)='(.*)'$/).slice(1)),
    )

const fund = async file => {
    const env = readEnv(file)
    const algod = new algosdk.Algodv2('', TESTNET_ALGOD, '')
    const treasury = algosdk.mnemonicToSecretKey(env.MNEMONIC_25_WORD)
    const balance = async address =>
        (await algod.accountInformation(address).do()).amount
    const authOf = async address =>
        (await algod.accountInformation(address).do()).authAddr?.toString()
    const submit = async (txn, sk) => {
        const { txid } = await algod.sendRawTransaction(txn.signTxn(sk)).do()
        await algosdk.waitForConfirmation(algod, txid, 8)
        return txid
    }

    const rekeyedIntoWallet = algosdk.mnemonicToSecretKey(
        env.E2E_FIXTURE_REKEYED_INTO_WALLET_MNEMONIC,
    )
    const rekeyedIntoAuth = algosdk.mnemonicToSecretKey(
        env.E2E_FIXTURE_REKEYED_INTO_AUTH_MNEMONIC,
    )
    const rekeyedWalletAddress = await universalAddress(
        env.MNEMONIC_24_REKEYED_ACCOUNT,
    )
    const targets = [
        ['E2E_FUNDED_ADDRESS', env.E2E_FUNDED_ADDRESS, 3n * MICRO],
        [
            'MNEMONIC_24_WORD',
            await universalAddress(env.MNEMONIC_24_WORD),
            MICRO / 2n,
        ],
        ['MNEMONIC_24_REKEYED_ACCOUNT', rekeyedWalletAddress, MICRO / 2n],
        [
            'rekeyed into that wallet',
            rekeyedIntoWallet.addr.toString(),
            MICRO / 2n,
        ],
        ['E2E_REKEY_AUTH_ADDRESS', env.E2E_REKEY_AUTH_ADDRESS, MICRO / 2n],
        ['E2E_REKEYED_ADDRESS', rekeyedIntoAuth.addr.toString(), MICRO / 2n],
    ]

    const needed = targets.reduce(
        (sum, [, , amount]) => sum + amount,
        ACCOUNT_RESERVE,
    )
    const available = await balance(treasury.addr.toString())
    console.log(
        `Treasury ${treasury.addr} holds ${Number(available) / 1e6} ALGO.`,
    )

    for (const [label, address, amount] of targets) {
        const held = await balance(address)
        if (held >= amount) {
            console.log(`  ${label}: already holds ${Number(held) / 1e6} ALGO`)
            continue
        }
        if (
            (await balance(treasury.addr.toString())) <
            amount - held + ACCOUNT_RESERVE
        ) {
            throw new Error(
                `Treasury short of the ${Number(needed) / 1e6} ALGO a full run needs; fund it and rerun.`,
            )
        }
        const params = await algod.getTransactionParams().do()
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: treasury.addr,
            receiver: address,
            amount: amount - held,
            suggestedParams: params,
        })
        await submit(txn, treasury.sk)
        console.log(
            `  ${label}: sent ${Number(amount - held) / 1e6} ALGO to ${address}`,
        )
    }

    const rekeys = [
        [
            'into MNEMONIC_24_REKEYED_ACCOUNT',
            rekeyedIntoWallet,
            rekeyedWalletAddress,
        ],
        [
            'E2E_REKEYED_ADDRESS into E2E_REKEY_AUTH_ADDRESS',
            rekeyedIntoAuth,
            env.E2E_REKEY_AUTH_ADDRESS,
        ],
    ]
    for (const [label, account, authAddress] of rekeys) {
        if ((await authOf(account.addr.toString())) === authAddress) {
            console.log(`  rekey ${label}: already done`)
            continue
        }
        const params = await algod.getTransactionParams().do()
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: account.addr,
            receiver: account.addr,
            amount: 0,
            rekeyTo: authAddress,
            suggestedParams: params,
        })
        await submit(txn, account.sk)
        console.log(`  rekey ${label}: done`)
    }
    await ensureNft(algod, submit, treasury, env.E2E_FUNDED_MNEMONIC)
    console.log('Testnet fixtures are ready.')
}

const NFT_UNIT = 'PE2ENFT'

// The assets cases open a collectible from the funded account's NFTs tab, so it holds one
// single-unit asset the treasury mints. The account is a universal wallet, so its opt-in is
// signed with the XHD key the app derives rather than an algosdk account.
const ensureNft = async (algod, submit, treasury, fundedMnemonic) => {
    const funded = await universalAddress(fundedMnemonic)
    const { assets = [] } = await algod.accountInformation(funded).do()
    const created =
        (await algod.accountInformation(treasury.addr).do()).createdAssets ?? []
    const nft = created.find(asset => asset.params.unitName === NFT_UNIT)
    if (
        nft &&
        assets.some(held => held.assetId === nft.index && held.amount > 0n)
    ) {
        console.log(`  NFT ${nft.index}: already held`)
        return
    }
    let assetId = nft?.index
    if (assetId === undefined) {
        const params = await algod.getTransactionParams().do()
        const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
            sender: treasury.addr,
            total: 1,
            decimals: 0,
            defaultFrozen: false,
            unitName: NFT_UNIT,
            assetName: 'Pera E2E NFT',
            assetURL: 'https://perawallet.app',
            note: new TextEncoder().encode(
                JSON.stringify({
                    standard: 'arc69',
                    description: 'Pera e2e fixture',
                }),
            ),
            suggestedParams: params,
        })
        const txid = await submit(txn, treasury.sk)
        assetId = (await algod.pendingTransactionInformation(txid).do())
            .assetIndex
        console.log(`  NFT ${assetId}: minted`)
    }
    if (!assets.some(held => held.assetId === assetId)) {
        const params = await algod.getTransactionParams().do()
        const optIn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(
            {
                sender: funded,
                receiver: funded,
                assetIndex: assetId,
                amount: 0,
                suggestedParams: params,
            },
        )
        const rootKey = xhd.fromSeed(
            Buffer.from(await mnemonicToSeed(fundedMnemonic)),
        )
        const signature = await new xhd.XHDWalletAPI().signAlgoTransaction(
            rootKey,
            xhd.KeyContext.Address,
            0,
            0,
            optIn.bytesToSign(),
            xhd.BIP32DerivationType.Peikert,
        )
        const { txid } = await algod
            .sendRawTransaction(optIn.attachSignature(funded, signature))
            .do()
        await algosdk.waitForConfirmation(algod, txid, 8)
        console.log(`  NFT ${assetId}: opted in`)
    }
    const params = await algod.getTransactionParams().do()
    const send = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: treasury.addr,
        receiver: funded,
        assetIndex: assetId,
        amount: 1,
        suggestedParams: params,
    })
    await submit(send, treasury.sk)
    console.log(`  NFT ${assetId}: sent to ${funded}`)
}

// Cases that need a wallet the app created (an imported phrase counts as backed up) fund it
// here from the treasury, which they read from MNEMONIC_25_WORD like the onboarding cases.
const pay = async (address, microAlgos) => {
    const algod = new algosdk.Algodv2('', TESTNET_ALGOD, '')
    const treasury = algosdk.mnemonicToSecretKey(process.env.MNEMONIC_25_WORD)
    const params = await algod.getTransactionParams().do()
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: treasury.addr,
        receiver: address,
        amount: BigInt(microAlgos),
        suggestedParams: params,
    })
    const { txid } = await algod
        .sendRawTransaction(txn.signTxn(treasury.sk))
        .do()
    await algosdk.waitForConfirmation(algod, txid, 8)
    console.log(txid)
}

const [command, ...args] = process.argv.slice(2)
const commands = {
    generate: () => generate(args[0]),
    fund: () => fund(args[0]),
    pay: () => pay(args[0], args[1]),
    // Reads the phrase from the named variable so it never appears on a command line.
    'address-of-env': async () =>
        console.log(await universalAddress(process.env[args[0]])),
}
if (!commands[command] || !args[0]) {
    console.error(
        'usage: testnet_fixtures.mjs <generate|fund> <env file> | pay <address> <microAlgos> | address-of-env <VAR>',
    )
    process.exit(2)
}
await commands[command]()
