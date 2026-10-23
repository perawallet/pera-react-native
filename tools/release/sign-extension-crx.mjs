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

// node tools/release/sign-extension-crx.mjs <zip>
//
// Wraps an extension zip, byte for byte, in a CRX3 signed with our key, written
// beside it as <name>.crx with a <name>.crx.sha256. The Chrome Web Store rejects
// a plain zip once "Verified CRX uploads" is on, and the key proves the upload
// came from us even if a dashboard account is taken over.
//
// Env:
//   CWS_CRX_SIGNING_KEY_BASE64  RSA private key PEM, base64; never written to disk

import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

const fail = message => {
    console.error(`sign-extension-crx: ${message}`)
    process.exit(1)
}

const varint = n => {
    const bytes = []
    while (n >= 0x80) {
        bytes.push((n & 0x7f) | 0x80)
        n >>>= 7
    }
    bytes.push(n)
    return Buffer.from(bytes)
}

// Every field the CRX3 header needs is length-delimited (wire type 2).
const field = (number, bytes) =>
    Buffer.concat([varint(number * 8 + 2), varint(bytes.length), bytes])

const uint32le = n => {
    const bytes = Buffer.alloc(4)
    bytes.writeUInt32LE(n)
    return bytes
}

const zipPath = process.argv[2]
const keyBase64 = process.env.CWS_CRX_SIGNING_KEY_BASE64

if (!zipPath) fail('no zip path given')
if (!keyBase64) fail('CWS_CRX_SIGNING_KEY_BASE64 is not set')

const notAnRsaKey =
    'CWS_CRX_SIGNING_KEY_BASE64 is not a base64-encoded RSA private key PEM'
let privateKey
try {
    privateKey = createPrivateKey(Buffer.from(keyBase64, 'base64'))
} catch {
    fail(notAnRsaKey)
}
if (privateKey.asymmetricKeyType !== 'rsa') fail(notAnRsaKey)

const archive = await readFile(zipPath).catch(() =>
    fail(`cannot read ${zipPath}`),
)
if (!archive.subarray(0, 4).equals(Buffer.from('PK\x03\x04', 'latin1'))) {
    fail(`${zipPath} is not a zip`)
}

const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
const signedData = field(
    1,
    createHash('sha256').update(spki).digest().subarray(0, 16),
)
// PKCS#1 v1.5, not PSS: crx3.proto's comment says PSS but crx_creator.cc signs
// RSA_PKCS1_SHA256 and Chrome verifies only that. Node's sign() defaults to it.
const signature = sign(
    'sha256',
    Buffer.concat([
        Buffer.from('CRX3 SignedData\0', 'latin1'),
        uint32le(signedData.length),
        signedData,
        archive,
    ]),
    privateKey,
)
// Fields in field-number order (2, then 10000), as Chrome's serializer emits
// them, so the file is byte-identical to Chrome's --pack-extension output.
const header = Buffer.concat([
    field(2, Buffer.concat([field(1, spki), field(2, signature)])),
    field(10000, signedData),
])
const crx = Buffer.concat([
    Buffer.from('Cr24', 'latin1'),
    uint32le(3),
    uint32le(header.length),
    header,
    archive,
])

const crxPath = `${zipPath.replace(/\.zip$/, '')}.crx`
await writeFile(crxPath, crx).catch(() => fail(`cannot write ${crxPath}`))
await writeFile(
    `${crxPath}.sha256`,
    `${createHash('sha256').update(crx).digest('hex')}  ${basename(crxPath)}\n`,
).catch(() => fail(`cannot write ${crxPath}.sha256`))
console.log(`Signed ${basename(crxPath)} (${crx.length} bytes)`)
