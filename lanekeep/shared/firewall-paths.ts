/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

/** The only directory that may import a Falcon library. The spec asserts it exists. */
export const PQ_SEAM_DIR = 'packages/kms/src/crypto/pq'

/** The only directory that may import a secp256k1 library. The spec asserts it exists. */
export const SECP256K1_SEAM_DIR =
    'extensions/provider/src/keystore/shims/secp256k1'

/**
 * A repo path as a gate glob: a file matches itself, a directory everything
 * under it. The `**` prefix lets fixture trees mirror the path.
 */
export const glob = (path: string): string =>
    /\.[a-z]+$/.test(path) ? `**/${path}` : `**/${path}/**`
