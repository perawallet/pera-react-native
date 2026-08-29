import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { falcon1024 } from '@algorandfoundation/falcon-wasm'
import { deriveQuantumAddress } from '../packages/blockchain/src/pq/quantumAdapter'

const DEFAULT_ALGOS = 100

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    const isNew = args.includes('--new')
    const isNewQuantum = args.includes('--new-quantum')
    const positional = args.filter(arg => !arg.startsWith('--'))

    const algorand = AlgorandClient.defaultLocalNet()

    // Reachability check — fail fast with a clear message.
    try {
        await algorand.client.algod.status().do()
    } catch {
        console.error(
            'ERROR: LocalNet not reachable at http://localhost:4001. Run `pnpm localnet` first.',
        )
        process.exit(1)
    }

    let receiver: string
    let mnemonic: string | undefined
    let quantumSeedHex: string | undefined
    let amountIndex: number

    if (isNew) {
        const account = algosdk.generateAccount()
        receiver = account.addr.toString()
        mnemonic = algosdk.secretKeyToMnemonic(account.sk)
        amountIndex = 0
    } else if (isNewQuantum) {
        // A quantum (post-quantum, Falcon-1024) address is an ordinary
        // 32-byte Algorand address — funding it needs no special handling,
        // only minting the keypair does. There is no mnemonic for a Falcon
        // key here, so the raw seed (hex) is printed instead: reseed
        // `generateKey` with it to reconstruct the same keypair.
        const seed = new Uint8Array(48)
        crypto.getRandomValues(seed)
        const { publicKey } = falcon1024.generateKey(seed)
        receiver = deriveQuantumAddress(publicKey)
        quantumSeedHex = Buffer.from(seed).toString('hex')
        amountIndex = 0
    } else {
        receiver = positional[0] ?? ''
        amountIndex = 1
        if (!receiver) {
            console.error(
                'Usage: pnpm localnet:fund <ADDRESS> [amountAlgos]\n' +
                    '       pnpm localnet:fund --new [amountAlgos]\n' +
                    '       pnpm localnet:fund --new-quantum [amountAlgos]',
            )
            process.exit(1)
        }
        if (!algosdk.isValidAddress(receiver)) {
            console.error(`ERROR: invalid Algorand address "${receiver}".`)
            process.exit(1)
        }
    }

    const amountAlgos = Number(positional[amountIndex] ?? DEFAULT_ALGOS)
    if (!Number.isFinite(amountAlgos) || amountAlgos <= 0) {
        console.error(`ERROR: invalid amount "${positional[amountIndex]}".`)
        process.exit(1)
    }

    const dispenser = await algorand.account.localNetDispenser()
    await algorand.send.payment({
        sender: dispenser.addr,
        receiver,
        amount: algo(amountAlgos),
    })

    console.log(`✓ Funded ${receiver} with ${amountAlgos} ALGO.`)
    if (mnemonic) {
        console.log('  New account created — save this mnemonic:')
        console.log(`  ${mnemonic}`)
    }
    if (quantumSeedHex) {
        console.log('  New quantum account created — save this seed (hex):')
        console.log(`  ${quantumSeedHex}`)
    }
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
