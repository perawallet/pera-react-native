import { describe, test, expect, vi } from 'vitest'
import { Networks } from '../../services/blockchain/types'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'



describe('store/app-store', () => {
	test('initializes defaults, updates, and persists selected keys', async () => {
		const kv = new MemoryKeyValueStorage()

		// Register platform services so app-store persist() can resolve storage via the container
		registerTestPlatform({
			keyValueStorage: kv,
		})

		// First load: verify defaults and update values
		vi.resetModules()
		{
			const { useAppStore } = await import('../app-store')
			const state = useAppStore.getState()

			expect(state.theme).toBe('system')
			expect(state.fcmToken).toBeNull()
			expect(state.network).toBe(Networks.mainnet)

			state.setTheme('dark')
			state.setFcmToken('abc')
			state.setNetwork(Networks.testnet)
		}

		// Second load (fresh module context): verify rehydration from persisted storage
		vi.resetModules()
		{
			const { useAppStore } = await import('../app-store')
			const rehydrated = useAppStore.getState()

			expect(rehydrated.theme).toBe('dark')
			expect(rehydrated.fcmToken).toBe('abc')
			expect(rehydrated.network).toBe(Networks.testnet)
		}
	})
})
