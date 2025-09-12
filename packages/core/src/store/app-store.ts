import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { container } from "tsyringe";
import {
  type KeyValueStorageService,
  KeyValueStorageServiceContainerKey,
} from "../services/storage/key-value-storage";

type ThemeMode = "light" | "dark" | "system";

export type AppState = {
  theme: ThemeMode;
  fcmToken: string | null;
  setTheme: (theme: ThemeMode) => void;
  setFcmToken: (token: string | null) => void;
};

export const createAppStore = () => {
  const kvStorage = container.resolve<KeyValueStorageService>(
    KeyValueStorageServiceContainerKey
  );
  return create<AppState>()(
    persist(
      (set) => ({
        theme: "system",
        fcmToken: null,
        setTheme: (theme) => set({ theme }),
        setFcmToken: (token) => set({ fcmToken: token }),
      }),
      {
        name: "app-store",
        storage: createJSONStorage(() => kvStorage),
        version: 1,
        partialize: (state) => ({
          fcmToken: state.fcmToken,
          theme: state.theme,
        }),
      }
    )
  );
};
