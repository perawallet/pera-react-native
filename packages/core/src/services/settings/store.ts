import type { StateCreator } from "zustand";
import type { ThemeMode } from "./types";

export type SettingsSlice = {
  theme: ThemeMode;
  fcmToken: string | null;
  setTheme: (theme: ThemeMode) => void;
  setFcmToken: (token: string | null) => void;
};

export const createSettingsSlice: StateCreator<
  SettingsSlice,
  [],
  [],
  SettingsSlice
> = (set) => {
  return {
    theme: "system",
    fcmToken: null,
    setTheme: (theme) => set({ theme }),
    setFcmToken: (token) => set({ fcmToken: token }),
  };
};

export const partializeSettingsSlice = (state: SettingsSlice) => {
  return {
    theme: state.theme,
    fcmToken: state.fcmToken,
  };
};
