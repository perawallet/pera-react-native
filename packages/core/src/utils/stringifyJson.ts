export const stringifyJson = (data: unknown) =>
	JSON.stringify(data, (_key, value) => {
		if (typeof value === 'bigint') {
			return `${value}BigInt`
		}
		return value
	}).replace(/"(-?\d+)BigInt"/g, '$1')
