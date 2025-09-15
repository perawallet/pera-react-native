import type { StateCreator } from "zustand";
import { type WalletAccount } from "./types";

export type AccountsSlice = {
  accounts: WalletAccount[];
  setAccounts: (accounts: WalletAccount[]) => void;
};

export const createAccountsSlice: StateCreator<
  AccountsSlice,
  [],
  [],
  AccountsSlice
> = (set) => {
  return {
    accounts: [],
    setAccounts: (accounts: WalletAccount[]) => {
      set({ accounts });
    },
  };
};
