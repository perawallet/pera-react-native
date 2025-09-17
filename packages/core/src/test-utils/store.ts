/**
 * Factory to create a vi.mock()-compatible module that exposes a Zustand-like useAppStore.
 * It supports selector usage and exposes getState/setState helpers for tests.
 */
export function createUseAppStoreMock<TState extends Record<string, any>>(
	initial: TState,
) {
	let state = { ...initial } as TState

	const useAppStore: any = (selector: (s: TState) => any) => selector(state)
	useAppStore.getState = () => state
	useAppStore.setState = (partial: Partial<TState>) => {
		state = { ...state, ...partial } as TState
	}

	return { useAppStore }
}
