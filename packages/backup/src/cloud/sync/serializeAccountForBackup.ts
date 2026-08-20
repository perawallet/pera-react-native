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

import {
  AccountTypes,
  type WalletAccount,
  type HDWalletAccount,
} from "@perawallet/wallet-core-accounts";
import type { Nullable } from "@perawallet/wallet-core-shared";
import {
  BackupAccountType,
  BackupItemType,
  type SecretsBackupPayload,
} from "../models";
import { serializeAccountItems } from "./serializeAccountItems";
import type {
  SerializedAccount,
  SerializedItem,
  SerializeHdResolver,
} from "./types";

type Deps = {
  updatedAt: number;
  withSecret: <T>(
    id: string,
    handler: (bytes: Uint8Array) => T | Promise<T>,
  ) => Promise<Nullable<T>>;
  algo25SecretKeyToMnemonic: (secretKey: Uint8Array) => string;
  /** Resolves HD seed/derived material; omitted/null => HD account skipped. */
  resolveHd?: SerializeHdResolver;
};

/** Imperative (non-hook) account serializer for the background manager. Reveals
 *  the Algo25 mnemonic via `withSecret`; resolves HD seed/derived material via
 *  `resolveHd` (the seed rides as a shared HdSeed secret in extraItems);
 *  secret-less types => address-only. */
export const serializeAccountForBackup = async (
  account: WalletAccount,
  { updatedAt, withSecret, algo25SecretKeyToMnemonic, resolveHd }: Deps,
): Promise<SerializedAccount | null> => {
  if (account.type === AccountTypes.hdWallet) {
    return serializeHdAccount(account, updatedAt, resolveHd);
  }

  let secrets: SecretsBackupPayload | null = null;
  if (account.type === AccountTypes.algo25 && account.keyPairId) {
    const mnemonic = await withSecret(account.keyPairId, (bytes) =>
      algo25SecretKeyToMnemonic(bytes),
    );
    if (!mnemonic) return null;
    secrets = { type: "Algo25", mnemonic };
  }
  return serializeAccountItems(account, { updatedAt, secrets });
};

/** HD child -> HdKey address item; the seed rides as a shared HdSeed secret at
 *  secrets/<seedFirstDerivedAddress> (deduped by buildLocalItems). */
const serializeHdAccount = async (
  account: HDWalletAccount,
  updatedAt: number,
  resolveHd?: SerializeHdResolver,
): Promise<SerializedAccount | null> => {
  if (!resolveHd) return null;
  const resolved = await resolveHd(account);
  if (!resolved) return null;

  const base = serializeAccountItems(account, {
    updatedAt,
    secrets: null,
    hd: {
      seedFirstDerivedAddress: resolved.seedFirstDerivedAddress,
      publicKeyHex: resolved.publicKeyHex,
    },
  });
  if (!base) return null;

  const seedSecret: SerializedItem = {
    key: `secrets/${resolved.seedFirstDerivedAddress}`,
    type: BackupItemType.ACCOUNT,
    payload: {
      type: BackupAccountType.HdSeed,
      seed: resolved.seedHex,
      entropy: resolved.entropyHex,
    },
  };
  return { ...base, extraItems: [seedSecret] };
};
