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

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
    decodeUnsignedTransaction,
    encodeMsgpack,
    SignedTransaction,
} from 'algosdk'

const run = promisify(execFile)

const CONTAINER = 'algokit_sandbox_algod'
const ALGOKEY = '/node/bin/algokey'
const TXN_PATH = '/tmp/oracle.txn'
const STXN_PATH = '/tmp/oracle.stxn'

// docker exec's stdout is captured as a JS string; piping arbitrary signed-transaction
// bytes through it would corrupt anything that isn't valid UTF-8. Binary reads always
// go through `base64` inside the container instead — see readFileBase64.
const docker = async (args: string[], stdin?: Uint8Array): Promise<string> => {
    const child = run(
        'docker',
        ['exec', ...(stdin ? ['-i'] : []), CONTAINER, ...args],
        {
            maxBuffer: 64 * 1024 * 1024,
        },
    )
    if (stdin) {
        child.child.stdin?.end(Buffer.from(stdin))
    }
    const { stdout } = await child
    return stdout
}

// The shell string here is a fixed constant path we control, never caller input —
// mnemonics and other untrusted values always go in as their own argv element.
const writeFile = (path: string, bytes: Uint8Array): Promise<string> =>
    docker(['sh', '-c', `cat > ${path}`], bytes)

const readFileBase64 = async (path: string): Promise<Uint8Array> => {
    const out = await docker(['base64', path])
    return new Uint8Array(Buffer.from(out.replace(/\s+/g, ''), 'base64'))
}

export const isAlgokeyAvailable = async (): Promise<boolean> => {
    try {
        await docker([ALGOKEY, '-v'])
        return true
    } catch {
        return false
    }
}

const field = (output: string, label: string): string => {
    const line = output.split('\n').find(l => l.startsWith(`${label}:`))
    if (!line) throw new Error(`algokey output missing "${label}":\n${output}`)
    return line.slice(label.length + 1).trim()
}

export const algokeyAddressFromMnemonic = async (
    mnemonic: string,
): Promise<string> => {
    const out = await docker([
        ALGOKEY,
        'import',
        '-m',
        mnemonic,
        '-f',
        '/tmp/oracle.key',
    ])
    return field(out, 'Public key')
}

export const algokeyQuantumAddressFromMnemonic = async (
    mnemonic: string,
): Promise<{ address: string; publicKey: Uint8Array; salt: number }> => {
    await docker(['sh', '-c', 'rm -f /tmp/oracle-pq.key'])
    await docker([
        ALGOKEY,
        'pq',
        'import',
        '-m',
        mnemonic,
        '-k',
        '/tmp/oracle-pq.key',
    ])
    const out = await docker([
        ALGOKEY,
        'pq',
        'info',
        '-k',
        '/tmp/oracle-pq.key',
    ])

    return {
        address: field(out, 'PQ address'),
        publicKey: new Uint8Array(
            Buffer.from(field(out, 'PQ public key'), 'base64'),
        ),
        salt: Number(field(out, 'PQ address salt')),
    }
}

// algokey sign/pq sign read a SignedTxn-shaped file with only `txn` populated (the same
// shell `goal clerk send -o` writes) — not the bare Transaction bytes `encodeUnsignedTransaction`
// produces. Decoding and rewrapping here keeps that CLI quirk out of every caller.
const wrapUnsignedTxn = (unsignedTxn: Uint8Array): Uint8Array => {
    const txn = decodeUnsignedTransaction(unsignedTxn)
    return encodeMsgpack(new SignedTransaction({ txn }))
}

export const algokeySign = async (params: {
    mnemonic: string
    unsignedTxn: Uint8Array
}): Promise<Uint8Array> => {
    await writeFile(TXN_PATH, wrapUnsignedTxn(params.unsignedTxn))
    await docker([
        ALGOKEY,
        'sign',
        '-m',
        params.mnemonic,
        '-t',
        TXN_PATH,
        '-o',
        STXN_PATH,
    ])
    return readFileBase64(STXN_PATH)
}

export const algokeyQuantumSign = async (params: {
    mnemonic: string
    unsignedTxn: Uint8Array
}): Promise<Uint8Array> => {
    await writeFile(TXN_PATH, wrapUnsignedTxn(params.unsignedTxn))
    await docker([
        ALGOKEY,
        'pq',
        'sign',
        '-S',
        'falcon-1024',
        '-m',
        params.mnemonic,
        '-t',
        TXN_PATH,
        '-o',
        STXN_PATH,
    ])
    return readFileBase64(STXN_PATH)
}

// Unlike sign/pq sign, `algokey multisig` expects its input already shaped as a multisig
// preimage blob (msig.v/thr/subsig[].pk populated, sigs empty) — exactly what algosdk's
// own `createMultisigTransaction` produces. There is no bare-Transaction form to wrap: the
// caller is expected to hand in that preimage directly as `unsignedTxn`.
export const algokeyMultisigSign = async (params: {
    mnemonic: string
    unsignedTxn: Uint8Array
}): Promise<Uint8Array> => {
    await writeFile(TXN_PATH, params.unsignedTxn)
    await docker([
        ALGOKEY,
        'multisig',
        '-m',
        params.mnemonic,
        '-t',
        TXN_PATH,
        '-o',
        STXN_PATH,
    ])
    return readFileBase64(STXN_PATH)
}
