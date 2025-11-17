import React from 'react';

/**
 * Loading Component
 * Reusable loading spinner for consistent UX
 */

const Loading = ({ 
  size = 'md', 
  fullScreen = false, 
  message = 'Loading...',
  color = 'blue'
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colors = {
    blue: 'border-blue-600',
    purple: 'border-purple-600',
    white: 'border-white'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`${sizes[size]} border-4 ${colors[color]} border-t-transparent rounded-full animate-spin`}
      />
      {message && (
        <p className={`mt-4 text-sm ${color === 'white' ? 'text-white' : 'text-gray-600'}`}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * Skeleton Loader Component
 * For content placeholders
 */
export const SkeletonLoader = ({ 
  type = 'text', 
  count = 1,
  className = ''
}) => {
  const skeletons = {
    text: 'h-4 bg-gray-200 rounded animate-pulse',
    title: 'h-6 bg-gray-200 rounded animate-pulse',
    avatar: 'h-12 w-12 bg-gray-200 rounded-full animate-pulse',
    image: 'h-48 bg-gray-200 rounded animate-pulse',
    card: 'h-32 bg-gray-200 rounded-lg animate-pulse'
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={skeletons[type]} />
      ))}
    </div>
  );
};

/**
 * Chat Message Skeleton
 */
export const ChatSkeleton = ({ count = 3 }) => {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
        >
          <div className="flex items-end gap-2 max-w-xs">
            {index % 2 === 0 && (
              <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
            )}
            <div className="space-y-2 flex-1">
              <div className="h-16 bg-gray-200 rounded-2xl animate-pulse" />
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Conversation List Skeleton
 */
export const ConversationSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
            <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default Loading;