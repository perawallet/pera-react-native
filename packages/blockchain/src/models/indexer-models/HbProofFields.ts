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
 * @description \\[hbprf\\] HbProof is a signature using HeartbeatAddress\'s partkey, thereby showing it is online.
 */
export type HbProofFields = {
    /**
     * @description \\[p\\] Public key of the heartbeat message.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    'hb-pk'?: string
    /**
     * @description \\[p1s\\] Signature of OneTimeSignatureSubkeyOffsetID(PK, Batch, Offset) under the key PK2.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    'hb-pk1sig'?: string
    /**
     * @description \\[p2\\] Key for new-style two-level ephemeral signature.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    'hb-pk2'?: string
    /**
     * @description \\[p2s\\] Signature of OneTimeSignatureSubkeyBatchID(PK2, Batch) under the master key (OneTimeSignatureVerifier).
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    'hb-pk2sig'?: string
    /**
     * @description \\[s\\] Signature of the heartbeat message.
     * @pattern ^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$
     * @type string | undefined, byte
     */
    'hb-sig'?: string
}
