const OnboardingScreen = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Welcome to Pera Wallet</h1>
      <p>Get started with your crypto journey</p>
      {/* Placeholder content */}
      <div className="mt-8 text-center">
        <button className="px-6 py-3 bg-blue-500 text-white rounded-lg text-lg">
          Create New Account
        </button>
        <button className="px-6 py-3 bg-gray-500 text-white rounded-lg text-lg ml-4">
          Import Existing Account
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
