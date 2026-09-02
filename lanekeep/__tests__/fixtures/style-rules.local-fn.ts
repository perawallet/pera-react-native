// A local `makeStyles` that shares the rneui name but isn't the import.
// Its returned object is bait for all three rules — none should fire here.
function makeStyles(factory: (theme: unknown) => object) {
    return factory
}

export const useStyles = makeStyles(theme => ({
    container: {
        fontSize: 14,
        padding: 16,
    },
    empty: {},
}))
