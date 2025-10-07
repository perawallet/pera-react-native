const SwapScreen = () => {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-textMain mb-2">Swap</h1>
        <p className="text-lg text-textGrayLighter">Exchange your assets instantly</p>
      </div>

      <div className="bg-white rounded-2xl border border-grey2 p-8 shadow-sm">
        {/* From Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-textGrayLighter mb-3">From</label>
          <div className="flex items-center bg-grey0 rounded-xl p-4 border border-grey2">
            <div className="flex items-center flex-1">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold mr-3">
                ₳
              </div>
              <div>
                <div className="font-semibold text-textMain">ALGO</div>
                <div className="text-sm text-textGrayLighter">Algorand</div>
              </div>
            </div>
            <input
              type="number"
              className="text-right text-2xl font-bold text-textMain bg-transparent border-none outline-none w-32"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-6">
          <button className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-shadow duration-200">
            ⇅
          </button>
        </div>

        {/* To Section */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-textGrayLighter mb-3">To</label>
          <div className="flex items-center bg-grey0 rounded-xl p-4 border border-grey2">
            <div className="flex items-center flex-1">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-white font-bold mr-3">
                ◈
              </div>
              <div>
                <div className="font-semibold text-textMain">USDC</div>
                <div className="text-sm text-textGrayLighter">USD Coin</div>
              </div>
            </div>
            <input
              type="number"
              className="text-right text-2xl font-bold text-textMain bg-transparent border-none outline-none w-32"
              placeholder="0.00"
              readOnly
            />
          </div>
        </div>

        {/* Swap Details */}
        <div className="bg-grey0 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-textGrayLighter">Exchange Rate</span>
            <span className="text-textMain font-medium">1 ALGO ≈ 0.25 USDC</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-textGrayLighter">Network Fee</span>
            <span className="text-textMain font-medium">0.001 ALGO</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-textGrayLighter">Slippage Tolerance</span>
            <span className="text-textMain font-medium">0.5%</span>
          </div>
        </div>

        {/* Swap Button */}
        <button className="w-full bg-primary hover:bg-opacity-90 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-sm">
          🔄 Swap Assets
        </button>
      </div>
    </div>
  );
};

export default SwapScreen;
