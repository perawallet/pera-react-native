import { AlgorandClient, algo } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'

const DEFAULT_ALGOS = 100

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    const isNew = args.includes('--new')
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
    let amountIndex: number

    if (isNew) {
        const account = algosdk.generateAccount()
        receiver = account.addr.toString()
        mnemonic = algosdk.secretKeyToMnemonic(account.sk)
        amountIndex = 0
    } else {
        receiver = positional[0] ?? ''
        amountIndex = 1
        if (!receiver) {
            console.error(
                'Usage: pnpm localnet:fund <ADDRESS> [amountAlgos]\n' +
                    '       pnpm localnet:fund --new [amountAlgos]',
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
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
