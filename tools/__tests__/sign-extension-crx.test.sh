#!/usr/bin/env bash
set -uo pipefail

# Signs a zip with a throwaway RSA key and checks the CRX3 container against
# Chromium's format with openssl, so a container or signature regression fails
# here rather than at the store.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release/sign-extension-crx.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$WORK/key.pem" 2>/dev/null
openssl pkey -in "$WORK/key.pem" -pubout -out "$WORK/pub.pem" 2>/dev/null
openssl pkey -in "$WORK/key.pem" -pubout -outform DER -out "$WORK/pub.der" 2>/dev/null
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$WORK/ec.pem" 2>/dev/null
KEY_B64=$(base64 < "$WORK/key.pem" | tr -d '\n')
EC_B64=$(base64 < "$WORK/ec.pem" | tr -d '\n')
{ printf 'PK\003\004'; head -c 4096 /dev/urandom; } > "$WORK/ext.zip"
cp "$WORK/ext.zip" "$WORK/nokey.zip"
printf 'not a zip' > "$WORK/notzip.bin"
: > "$WORK/all.out"

# Reads a CRX3 the way crx_verifier.cc does and writes the signed message, the
# signature and the archive beside it for openssl and cmp.
cat > "$WORK/inspect.mjs" <<'INSPECT'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [crxPath, spkiPath] = process.argv.slice(2)
const crx = readFileSync(crxPath)
const spki = readFileSync(spkiPath)

const varint = (bytes, offset) => {
    let value = 0
    let shift = 0
    for (;;) {
        const byte = bytes[offset++]
        value += (byte & 0x7f) * 2 ** shift
        if (byte < 0x80) return [value, offset]
        shift += 7
    }
}

const fields = bytes => {
    const found = []
    let offset = 0
    while (offset < bytes.length) {
        let tag
        let length
        ;[tag, offset] = varint(bytes, offset)
        if (tag % 8 !== 2) throw new Error(`wire type ${tag % 8}`)
        ;[length, offset] = varint(bytes, offset)
        found.push([Math.floor(tag / 8), bytes.subarray(offset, offset + length)])
        offset += length
    }
    return found
}

const headerLength = crx.readUInt32LE(8)
const header = crx.subarray(12, 12 + headerLength)
const archive = crx.subarray(12 + headerLength)
const top = fields(header)
const proof = fields(top.find(([number]) => number === 2)[1])
const signedData = top.find(([number]) => number === 10000)[1]
const crxId = fields(signedData).find(([number]) => number === 1)[1]
const length = Buffer.alloc(4)
length.writeUInt32LE(signedData.length)

writeFileSync(`${crxPath}.message`, Buffer.concat([Buffer.from('CRX3 SignedData\0', 'latin1'), length, signedData, archive]))
writeFileSync(`${crxPath}.sig`, proof.find(([number]) => number === 2)[1])
writeFileSync(`${crxPath}.archive`, archive)

const list = entries => entries.map(([number, bytes]) => `${number}:${bytes.length}`).join(',')
const spkiMatch = proof.find(([number]) => number === 1)[1].equals(spki)
const idMatch = crxId.equals(createHash('sha256').update(spki).digest().subarray(0, 16))
console.log(
    `magic=${crx.subarray(0, 4).toString('latin1')} version=${crx.readUInt32LE(4)} header=${headerLength} fields=${list(top)} proof=${list(proof)} spki=${spkiMatch ? 'match' : 'differ'} crxid=${idMatch ? 'match' : 'differ'}`,
)
INSPECT

failures=0

check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# $1 label  $2 zip  $3 expected exit  $4 text the output must contain
# Remaining args are extra env assignments for this case.
run_case() {
    local label="$1" zip="$2" want="$3" expect="$4"
    shift 4
    local output status
    output=$(env CWS_CRX_SIGNING_KEY_BASE64="$KEY_B64" "$@" node "$SCRIPT" "$zip" 2>&1)
    status=$?
    printf '%s\n' "$output" >> "$WORK/all.out"
    if [ "$status" -eq "$want" ] && [[ "$output" == *"$expect"* ]]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want} and \"${expect}\", got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

run_case "signs the zip into a crx beside it" "$WORK/ext.zip" 0 "Signed ext.crx ("
check "crx sha256 is in sha256sum format" \
    "$(openssl dgst -sha256 -r "$WORK/ext.crx" 2>/dev/null | cut -d' ' -f1)  ext.crx" "$(cat "$WORK/ext.crx.sha256" 2>/dev/null)"
check "header is CRX3 with one RSA proof whose crx_id is the key hash" \
    "magic=Cr24 version=3 header=581 fields=2:556,10000:18 proof=1:294,2:256 spki=match crxid=match" \
    "$(node "$WORK/inspect.mjs" "$WORK/ext.crx" "$WORK/pub.der" 2>/dev/null)"
check "signature verifies with openssl over the signed message" "Verified OK" \
    "$(openssl dgst -sha256 -verify "$WORK/pub.pem" -signature "$WORK/ext.crx.sig" "$WORK/ext.crx.message" 2>&1)"
check "archive bytes equal the input zip" "" "$(cmp "$WORK/ext.crx.archive" "$WORK/ext.zip" 2>&1)"
cp "$WORK/ext.crx" "$WORK/first.crx" 2>/dev/null
run_case "signing again gives the same bytes" "$WORK/ext.zip" 0 "Signed ext.crx ("
check "crx is deterministic" "" "$(cmp "$WORK/ext.crx" "$WORK/first.crx" 2>&1)"
run_case "fails without a key" "$WORK/nokey.zip" 1 "CWS_CRX_SIGNING_KEY_BASE64 is not set" CWS_CRX_SIGNING_KEY_BASE64=
check "writes nothing without a key" "missing" "$([ -e "$WORK/nokey.crx" ] && echo present || echo missing)"
run_case "fails on a key that is not a PEM" "$WORK/ext.zip" 1 \
    "CWS_CRX_SIGNING_KEY_BASE64 is not a base64-encoded RSA private key PEM" \
    CWS_CRX_SIGNING_KEY_BASE64="$(printf 'not a key' | base64)"
run_case "fails on an EC key" "$WORK/ext.zip" 1 \
    "CWS_CRX_SIGNING_KEY_BASE64 is not a base64-encoded RSA private key PEM" \
    CWS_CRX_SIGNING_KEY_BASE64="$EC_B64"
run_case "fails on a missing zip" "$WORK/missing.zip" 1 "cannot read"
run_case "fails on a file that is not a zip" "$WORK/notzip.bin" 1 "is not a zip"

# The secret is the PEM in base64; its first characters only encode
# "-----BEGIN", so the check takes a slice from the middle.
if grep -qF "$(sed -n 2p "$WORK/key.pem")" "$WORK/all.out" || grep -q 'PRIVATE KEY' "$WORK/all.out" ||
    grep -qF "${KEY_B64:100:60}" "$WORK/all.out"; then
    echo "  FAIL  output carried key material"
    failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
echo "all cases passed"
