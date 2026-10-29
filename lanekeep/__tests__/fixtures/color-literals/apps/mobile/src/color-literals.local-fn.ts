// A local `makeStyles` that shares the rneui name but isn't the import.
function makeStyles(factory: (theme: unknown) => object) {
    return factory
}

export const useStyles = makeStyles(() => ({
    container: { backgroundColor: '#FFFFFF' },
}))
