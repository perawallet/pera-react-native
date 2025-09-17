import { vi } from 'vitest'

export type KyCallRecord = {
	label: string
	input: any
	options: any
}

export function createKyMock() {
	let createCalls: any[] = []
	let callRecords: KyCallRecord[] = []
	let createIndex = 0

	const makeInstance = (label: string) =>
		vi.fn(async (input: any, options: any) => {
			callRecords.push({ label, input, options })
			return {
				async json() {
					return { ok: label }
				},
				status: 200,
				statusText: 'OK',
			} as any
		})

	const create = vi.fn((opts: any) => {
		createCalls.push(opts)
		const label =
			createIndex === 0
				? 'mainnet'
				: createIndex === 1
					? 'testnet'
					: `inst${createIndex}`
		createIndex++
		return makeInstance(label)
	})

	const install = () => {
		vi.mock('ky', () => ({
			__esModule: true,
			default: { create },
		}))
	}

	const reset = () => {
		createCalls = []
		callRecords = []
		createIndex = 0
		create.mockClear()
	}

	return {
		install,
		reset,
		get createCalls() {
			return createCalls
		},
		get callRecords() {
			return callRecords
		},
	}
}
