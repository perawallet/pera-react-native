import type { StateCreator } from 'zustand'
import type { ThemeMode } from './types'

export type SettingsSlice = {
	theme: ThemeMode
	setTheme: (theme: ThemeMode) => void
}

export const createSettingsSlice: StateCreator<
	SettingsSlice,
	[],
	[],
	SettingsSlice
> = set => {
	return {
		theme: 'system',
		setTheme: theme => set({ theme }),
	}
}

export const partializeSettingsSlice = (state: SettingsSlice) => {
	return {
		theme: state.theme,
	}
}
