import { Link } from 'react-router-dom';

const MenuScreen = () => {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-textMain mb-2">Menu</h1>
        <p className="text-lg text-textGrayLighter">Access settings and more options</p>
      </div>

      <div className="space-y-4">
        <Link
          to="/settings"
          className="block bg-white p-6 rounded-2xl border border-grey2 hover:border-primary hover:shadow-lg transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center">
            <div className="text-3xl mr-4 group-hover:scale-110 transition-transform duration-200">⚙️</div>
            <div>
              <h3 className="text-xl font-semibold text-textMain mb-1">Settings</h3>
              <p className="text-textGrayLighter">Configure your preferences and security options</p>
            </div>
          </div>
        </Link>

        <div className="bg-white p-6 rounded-2xl border border-grey2 hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <div className="flex items-center">
            <div className="text-3xl mr-4 group-hover:scale-110 transition-transform duration-200">🆘</div>
            <div>
              <h3 className="text-xl font-semibold text-textMain mb-1">Support</h3>
              <p className="text-textGrayLighter">Get help and contact our support team</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-grey2 hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <div className="flex items-center">
            <div className="text-3xl mr-4 group-hover:scale-110 transition-transform duration-200">ℹ️</div>
            <div>
              <h3 className="text-xl font-semibold text-textMain mb-1">About</h3>
              <p className="text-textGrayLighter">Learn more about Pera Wallet and our mission</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-grey2 hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <div className="flex items-center">
            <div className="text-3xl mr-4 group-hover:scale-110 transition-transform duration-200">📱</div>
            <div>
              <h3 className="text-xl font-semibold text-textMain mb-1">Mobile App</h3>
              <p className="text-textGrayLighter">Download the mobile version for on-the-go access</p>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div className="mt-12 text-center">
        <p className="text-sm text-textGrayLighter">Pera Wallet Desktop v1.0.0</p>
        <p className="text-xs text-textGray mt-1">© 2024 Algorand Foundation</p>
      </div>
    </div>
  );
};

export default MenuScreen;
