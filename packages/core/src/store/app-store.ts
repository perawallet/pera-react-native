import { create, type StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useKeyValueStorageService } from "../services";
import { createBlockchainSlice, type BlockchainSlice } from "~/services/blockchain";
import { createAccountsSlice, type AccountsSlice } from "~/services/accounts";

type ThemeMode = "light" | "dark" | "system";

export type AppSlice = {
  theme: ThemeMode;
  fcmToken: string | null;
  setTheme: (theme: ThemeMode) => void;
  setFcmToken: (token: string | null) => void;
};

const createAppSlice: StateCreator<AppSlice, [], [], AppSlice> = (set) => {
  return {
    theme: "system",
    fcmToken: null,
    setTheme: (theme) => set({ theme }),
    setFcmToken: (token) => set({ fcmToken: token }),
  }
}

export type AppState = AppSlice & AccountsSlice & BlockchainSlice
export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createBlockchainSlice(...a),
      ...createAccountsSlice(...a),
      ...createAppSlice(...a),
    }),
    {
      name: "app-store",
      storage: createJSONStorage(useKeyValueStorageService),
      version: 1,
      partialize: (state) => ({
        //TODO figure out a cleaner way to decide which keys to persist
        fcmToken: state.fcmToken,
        theme: state.theme,
        account: state.accounts,
        network: state.network,
      }),
    }
  )
);
