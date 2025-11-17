// Utility to get user ID regardless of property name (_id or id)
export const getUserId = (user) => {
  if (!user) return null;
  return user._id || user.id;
};

// Utility to compare user IDs (handles string vs ObjectId comparison)
export const isSameUser = (userId1, userId2) => {
  if (!userId1 || !userId2) return false;
  const id1 = typeof userId1 === 'object' ? (userId1._id || userId1.id) : userId1;
  const id2 = typeof userId2 === 'object' ? (userId2._id || userId2.id) : userId2;
  return String(id1) === String(id2);
};

// Check if a message belongs to the current user
export const isMessageFromUser = (message, currentUser) => {
  const messageUserId = message.sender?._id || message.sender;
  const currentUserId = getUserId(currentUser);
  return isSameUser(messageUserId, currentUserId);
};