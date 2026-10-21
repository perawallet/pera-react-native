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

// Packs an extension zip into a CRX3 signed with one RSA key, byte for byte
// what `chrome --pack-extension` writes, so CI needs no Chrome and no package.
// Format: Chromium's components/crx_file/crx3.proto.

import {
    createHash,
    createPrivateKey,
    createPublicKey,
    sign,
} from 'node:crypto'

const MAGIC = Buffer.from('Cr24')
const VERSION = 3
const SIGNATURE_CONTEXT = Buffer.from('CRX3 SignedData\x00')

const uint32 = value => {
    const bytes = Buffer.alloc(4)
    bytes.writeUInt32LE(value)
    return bytes
}

const varint = value => {
    const bytes = []
    while (value > 0x7f) {
        bytes.push((value & 0x7f) | 0x80)
        value >>>= 7
    }
    bytes.push(value)
    return Buffer.from(bytes)
}

// Every field CRX3 uses is length-delimited (wire type 2).
const field = (number, payload) =>
    Buffer.concat([varint((number << 3) | 2), varint(payload.length), payload])

/**
 * @param {Buffer} zip the extension package
 * @param {string | Buffer} privateKeyPem RSA private key, PEM
 * @returns {Buffer} the CRX3 file
 */
export const packCrx3 = (zip, privateKeyPem) => {
    const privateKey = createPrivateKey(privateKeyPem)
    if (privateKey.asymmetricKeyType !== 'rsa') {
        throw new Error('the CRX signing key must be an RSA key')
    }
    const publicKey = createPublicKey(privateKey).export({
        type: 'spki',
        format: 'der',
    })
    const crxId = createHash('sha256')
        .update(publicKey)
        .digest()
        .subarray(0, 16)
    // SignedData { bytes crx_id = 1; }
    const signedHeaderData = field(1, crxId)
    const signature = sign(
        'sha256',
        Buffer.concat([
            SIGNATURE_CONTEXT,
            uint32(signedHeaderData.length),
            signedHeaderData,
            zip,
        ]),
        privateKey,
    )
    // CrxFileHeader { repeated AsymmetricKeyProof sha256_with_rsa = 2;
    //                 bytes signed_header_data = 10000; }
    // AsymmetricKeyProof { bytes public_key = 1; bytes signature = 2; }
    const header = Buffer.concat([
        field(2, Buffer.concat([field(1, publicKey), field(2, signature)])),
        field(10000, signedHeaderData),
    ])
    return Buffer.concat([
        MAGIC,
        uint32(VERSION),
        uint32(header.length),
        header,
        zip,
    ])
}
