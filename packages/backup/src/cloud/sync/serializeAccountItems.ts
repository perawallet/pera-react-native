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
} from "@perawallet/wallet-core-accounts";
import {
  BackupAccountType,
  BackupItemType,
  type AddressBackupPayload,
  type SecretsBackupPayload,
} from "../models";
import type { SerializedAccount } from "./types";

type SerializeParams = {
  /** Epoch millis to stamp on the address payload (LWW). */
  updatedAt: number;
  /** Secrets payload from KMS, or null for secret-less account types. */
  secrets: SecretsBackupPayload | null;
  /** Resolved HD derivation data; REQUIRED for hdWallet accounts (the account
   *  carries neither its derived public key nor the seed's first address). */
  hd?: { seedFirstDerivedAddress: string; publicKeyHex: string };
};

const accountsKey = (address: string): string => `accounts/${address}`;
const secretsKey = (address: string): string => `secrets/${address}`;

const nameValue = (a: WalletAccount): string | null => a.name ?? null;

/** Maps a supported WalletAccount to its address payload, or null when HD context is absent. */
const toAddressPayload = (
  a: WalletAccount,
  updatedAt: number,
  hd?: { seedFirstDerivedAddress: string; publicKeyHex: string },
): AddressBackupPayload | null => {
  switch (a.type) {
    case AccountTypes.algo25: {
      return {
        type: BackupAccountType.Algo25,
        address: a.address,
        customName: nameValue(a),
        updatedAt,
      };
    }
    case AccountTypes.watch: {
      return {
        type: BackupAccountType.NoAuth,
        address: a.address,
        customName: nameValue(a),
        updatedAt,
      };
    }
    case AccountTypes.hardware: {
      return {
        type: BackupAccountType.LedgerBle,
        address: a.address,
        deviceMacAddress: a.hardwareDetails.deviceId,
        bluetoothName: a.hardwareDetails.deviceName,
        indexInLedger: a.hardwareDetails.accountIndex,
        customName: nameValue(a),
        updatedAt,
      };
    }
    case AccountTypes.multisig: {
      return {
        type: BackupAccountType.Joint,
        address: a.address,
        participantAddresses: a.multisigDetails.addresses,
        threshold: a.multisigDetails.threshold,
        version: a.multisigDetails.version,
        customName: nameValue(a),
        updatedAt,
      };
    }
    case AccountTypes.hdWallet: {
      if (!hd) return null;
      return {
        type: BackupAccountType.HdKey,
        address: a.address,
        seedFirstDerivedAddress: hd.seedFirstDerivedAddress,
        publicKey: hd.publicKeyHex,
        account: a.hdWalletDetails.account,
        change: a.hdWalletDetails.change,
        keyIndex: a.hdWalletDetails.keyIndex,
        derivationType: a.hdWalletDetails.derivationType,
        customName: nameValue(a),
        updatedAt,
      };
    }
    default: {
      const exhaustive: never = a;
      return exhaustive;
    }
  }
};

export const serializeAccountItems = (
  account: WalletAccount,
  { updatedAt, secrets, hd }: SerializeParams,
): SerializedAccount | null => {
  const addressPayload = toAddressPayload(account, updatedAt, hd);
  if (addressPayload === null || !account.address) return null;

  const address = {
    key: accountsKey(account.address),
    type: BackupItemType.ACCOUNT,
    payload: addressPayload,
  };
  const secretsItem = secrets
    ? {
        key: secretsKey(account.address),
        type: BackupItemType.ACCOUNT,
        payload: secrets,
      }
    : null;
  return { address, secrets: secretsItem };
};
