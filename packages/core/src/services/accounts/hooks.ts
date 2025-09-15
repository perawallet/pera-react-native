import { useAppStore } from "../../store";
import { useSecureStorageService } from "../storage";
import { type WalletAccount } from "./types";

export const useAccounts = () => {
  const accounts = useAppStore((state) => state.accounts);
  const setAccounts = useAppStore((state) => state.setAccounts);
  const secureStorage = useSecureStorageService();

  return {
    getAllAccounts: () => accounts,
    findAccountByAddress: (address: string) => {
      return (
        accounts.find((a) => {
          a.address === address;
        }) ?? null
      );
    },
    addAccount: (account: WalletAccount, privateKey?: string) => {
      accounts.push(account);
      setAccounts(accounts);

      if (privateKey) {
        const storageKey = `pk-${account.address}`;
        secureStorage.setItem(storageKey, privateKey);
      }
    },
    removeAccountById: (id: string) => {
      const account = accounts.find((a) => a.id === id);
      if (account && account.privateKeyLocation) {
        const storageKey = `pk-${account.address}`;
        secureStorage.removeItem(storageKey);
      }
      const remaining = accounts.filter((a) => a.id !== id);
      setAccounts(remaining);
    },
    removeAccountByAddress: (address: string) => {
      const account = accounts.find((a) => a.address === address);
      if (account && account.privateKeyLocation) {
        const storageKey = `pk-${account.address}`;
        secureStorage.removeItem(storageKey);
      }
      const remaining = accounts.filter((a) => a.address !== address);
      setAccounts(remaining);
    },
  };
};
