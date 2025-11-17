import { useState } from 'react';

export default function SearchBar({ onSearch, placeholder = "Search..." }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className={`relative transition-all duration-300 ${isFocused ? 'scale-105' : ''}`}>
      <div className="relative">
        <input
          type="text"
          id="searchQuery"
          name="searchQuery"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 pl-11 pr-10 rounded-full border transition-all duration-300 ${
            isFocused 
              ? 'border-purple-500 shadow-lg ring-2 ring-purple-200' 
              : 'border-gray-300 shadow-sm'
          } focus:outline-none`}
        />
        
        {/* Search Icon */}
        <svg 
          className={`absolute left-4 top-3.5 w-5 h-5 transition-colors duration-300 ${
            isFocused ? 'text-purple-600' : 'text-gray-400'
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100 transition-colors animate-scaleIn"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Count */}
      {query && (
        <p className="text-xs text-gray-500 mt-2 ml-1 animate-fadeIn">
          Searching for "{query}"...
        </p>
      )}
    </div>
  );
}