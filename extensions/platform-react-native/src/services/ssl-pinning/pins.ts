/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * Base64 SHA-256 SPKI hashes of the ROOT CAs that may issue the edge
 * certificate for *.api.perawallet.app.
 *
 * The API is served through Cloudflare, whose Universal SSL issues edge
 * certificates from exactly three partner CAs — Google Trust Services,
 * Let's Encrypt, and SSL.com — and may switch between them on any renewal
 * (https://developers.cloudflare.com/ssl/reference/certificate-authorities/).
 * Pinning the union of those CAs' TLS roots therefore survives every rotation
 * Cloudflare can perform on its own, while still rejecting certificates from
 * any other CA (corporate MITM proxies, user-installed roots, mis-issuance).
 *
 * Roots are pinned — never leaves (rotate every ~90 days with fresh keys) and
 * never intermediates (CAs rotate them without notice). SPKI matching accepts
 * any certificate in the validated chain, and a root's key is identical in its
 * self-signed and cross-signed variants, so these pins hold on old devices
 * that validate through the GlobalSign / Certum cross-signs too.
 *
 * Hashes are computed from the PEMs published by each CA (pki.goog,
 * letsencrypt.org/certs, ssl.com/repository):
 *   openssl x509 -in root.pem -pubkey -noout \
 *     | openssl pkey -pubin -outform DER \
 *     | openssl dgst -sha256 -binary | openssl enc -base64
 * `tools/check-pinned-chains.mjs` re-verifies the live hosts against this
 * list; run it before every release.
 */
export const PINNED_ROOT_SPKI_HASHES: readonly string[] = [
    // Google Trust Services — GTS Root R1
    'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=',
    // Google Trust Services — GTS Root R2
    'Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=',
    // Google Trust Services — GTS Root R3
    'QXnt2YHvdHR3tJYmQIr0Paosp6t/nggsEGD4QJZ3Q0g=',
    // Google Trust Services — GTS Root R4
    'mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=',
    // Let's Encrypt — ISRG Root X1
    'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=',
    // Let's Encrypt — ISRG Root X2
    'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=',
    // SSL.com TLS RSA Root CA 2022
    'K89VOmb1cJAN3TK6bf4ezAbJGC1mLcG2Dh97dnwr3VQ=',
    // SSL.com TLS ECC Root CA 2022
    'G/ANXI8TwJTdF+AFBM8IiIUPEv0Gf6H5LA/b9guG4yE=',
    // SSL.com Root Certification Authority RSA
    '0cRTd+vc1hjNFlHcLgLCHXUeWqn80bNDH/bs9qMTSPo=',
    // SSL.com Root Certification Authority ECC
    'oyD01TTXvpfBro3QSZc1vIlcMjrdLTiL/M9mLCPX+Zo=',
]

/**
 * Fail-open backstop: pin enforcement stops after this date so an abandoned
 * app version degrades to normal TLS instead of bricking forever. Refresh to
 * roughly one year out as part of every release.
 */
export const SSL_PINNING_EXPIRATION_DATE = '2027-07-08'
