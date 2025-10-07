const ImportAccountScreen = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Import Account</h1>
      <p>Import your existing account using recovery phrase or private key</p>
      {/* Placeholder content */}
      <div className="mt-4">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Recovery Phrase</label>
          <textarea
            className="w-full p-3 border rounded h-24"
            placeholder="Enter your 25-word recovery phrase"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Private Key (optional)</label>
          <input
            className="w-full p-3 border rounded"
            placeholder="Enter private key"
          />
        </div>
        <button className="px-6 py-3 bg-blue-500 text-white rounded-lg">
          Import Account
        </button>
      </div>
    </div>
  );
};

export default ImportAccountScreen;
