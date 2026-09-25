it('asserts', () => {
    expect(1).toBe(1)
})
it('asserts through a helper named expect…', () => {
    expectRoundTrip(1)
})
test.beforeAll(async () => {
    await seed()
})
it('asserts nothing', () => {
    run()
})
