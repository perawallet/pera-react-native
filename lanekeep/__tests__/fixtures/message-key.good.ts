declare const dynamicKey: string

export const literal = { messageKey: 'common.back_online' }
export const notStatic = { messageKey: dynamicKey }
export const shorthand = ((messageKey: string) => ({ messageKey }))('x')
