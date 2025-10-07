const AccountScreen = () => {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-textMain mb-2">Account Details</h1>
        <p className="text-lg text-textGrayLighter">View and manage your account information</p>
      </div>

      {/* Account Overview Card */}
      <div className="bg-white rounded-2xl border border-grey2 p-8 mb-8 shadow-sm">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
            👤
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-textMain">Main Account</h2>
            <p className="text-textGrayLighter">Primary wallet account</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-grey0 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-textMain mb-2">Account Address</h3>
            <p className="text-sm text-textGrayLighter font-mono break-all">ABC123...XYZ789ABC123...XYZ789</p>
            <button className="mt-3 text-primary hover:text-secondary font-medium text-sm">
              📋 Copy Address
            </button>
          </div>

          <div className="bg-grey0 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-textMain mb-2">Total Balance</h3>
            <p className="text-2xl font-bold text-textMain">₳100.50</p>
            <p className="text-sm text-textGrayLighter">≈ $25.75 USD</p>
          </div>
        </div>
      </div>

      {/* Account Actions */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <button className="bg-primary hover:bg-opacity-90 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-sm">
          📤 Export Private Key
        </button>
        <button className="bg-error hover:bg-opacity-90 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-sm">
          🗑️ Delete Account
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-grey2 p-8 shadow-sm">
        <h3 className="text-2xl font-semibold text-textMain mb-6">Recent Transactions</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-grey0 rounded-xl">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center text-white mr-4">
                📥
              </div>
              <div>
                <p className="font-semibold text-textMain">Received ALGO</p>
                <p className="text-sm text-textGrayLighter">2 hours ago</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-success">+50.00 ALGO</p>
              <p className="text-sm text-textGrayLighter">≈ +$12.75</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-grey0 rounded-xl">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-error rounded-full flex items-center justify-center text-white mr-4">
                📤
              </div>
              <div>
                <p className="font-semibold text-textMain">Sent USDC</p>
                <p className="text-sm text-textGrayLighter">1 day ago</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-error">-25.00 USDC</p>
              <p className="text-sm text-textGrayLighter">≈ -$25.00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountScreen;
