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

import pkg from 'libsodium-wrappers-sumo'

const loadLibSodium = async () => {
    await pkg.ready

    return {
        crypto_core_ed25519_add: pkg.crypto_core_ed25519_add,
        crypto_core_ed25519_scalar_add: pkg.crypto_core_ed25519_scalar_add,
        crypto_core_ed25519_scalar_mul: pkg.crypto_core_ed25519_scalar_mul,
        crypto_core_ed25519_scalar_reduce:
            pkg.crypto_core_ed25519_scalar_reduce,
        crypto_hash_sha512: pkg.crypto_hash_sha512,
        crypto_scalarmult_ed25519_base_noclamp:
            pkg.crypto_scalarmult_ed25519_base_noclamp,
        crypto_sign_verify_detached: pkg.crypto_sign_verify_detached,
        crypto_sign_ed25519_pk_to_curve25519:
            pkg.crypto_sign_ed25519_pk_to_curve25519,
        crypto_scalarmult: pkg.crypto_scalarmult,
        crypto_generichash: pkg.crypto_generichash,
        crypto_sign_keypair: pkg.crypto_sign_keypair,
        crypto_sign_ed25519_sk_to_curve25519:
            pkg.crypto_sign_ed25519_sk_to_curve25519,
        crypto_secretbox_open_easy: pkg.crypto_secretbox_open_easy,
        crypto_secretbox_easy: pkg.crypto_secretbox_easy,
        crypto_kx_client_session_keys: pkg.crypto_kx_client_session_keys,
        crypto_kx_server_session_keys: pkg.crypto_kx_server_session_keys,
        to_base64: pkg.to_base64,
    }
}

export default loadLibSodium
