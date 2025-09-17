
export const DevicePlatforms = {
	ios: 'ios',
	android: 'android',
	web: 'web',
} as const

export type DevicePlatform =
	(typeof DevicePlatforms)[keyof typeof DevicePlatforms]