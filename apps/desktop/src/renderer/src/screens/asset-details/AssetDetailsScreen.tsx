const AssetDetailsScreen = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Asset Details</h1>
      <p>Detailed information about the selected asset</p>
      {/* Placeholder content */}
      <div className="mt-4">
        <div className="p-4 border rounded mb-4">
          <h3 className="font-semibold text-lg">ALGO</h3>
          <p className="text-sm text-gray-600">Algorand</p>
          <p className="text-2xl font-bold mt-2">$0.25</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded">
            <h4 className="font-semibold">Market Cap</h4>
            <p>$1.2B</p>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-semibold">24h Volume</h4>
            <p>$50M</p>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-semibold">Circulating Supply</h4>
            <p>8.1B ALGO</p>
          </div>
          <div className="p-4 border rounded">
            <h4 className="font-semibold">Your Balance</h4>
            <p>100.50 ALGO</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailsScreen;
