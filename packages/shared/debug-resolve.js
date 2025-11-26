try {
    const config = require('@perawallet/wallet-core-eslint-config');
    console.log('Resolved successfully:', config);
} catch (e) {
    console.error('Resolution failed:', e);
}
