import BottomNav from '../../components/BottomNav';

export default function Calls() {
  const callHistory = [
    // Mock data - replace with real data later
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 text-center">Calls</h1>
      </div>

      {/* Empty State */}
      <div className="flex-1 overflow-y-auto pb-20 flex items-center justify-center">
        <div className="text-center p-8">
          <svg 
            className="w-32 h-32 mx-auto text-gray-300 mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" 
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">No Call History</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Your call history will appear here once you make or receive calls
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-blue-800">
              📞 <strong>Coming Soon:</strong> Voice and video calling features!
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}