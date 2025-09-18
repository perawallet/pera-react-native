import pkg from 'libsodium-wrappers-sumo'

const loadLibSodium = async () => {
	await pkg.ready

	return {
		crypto_core_ed25519_add: pkg.crypto_core_ed25519_add,
		crypto_core_ed25519_scalar_add: pkg.crypto_core_ed25519_scalar_add,
		crypto_core_ed25519_scalar_mul: pkg.crypto_core_ed25519_scalar_mul,
		crypto_core_ed25519_scalar_reduce: pkg.crypto_core_ed25519_scalar_reduce,
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
