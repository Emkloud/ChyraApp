export default function UserAvatar({ user, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-14 h-14 text-xl',
    '2xl': 'w-16 h-16 text-2xl',
    '3xl': 'w-20 h-20 text-3xl'
  };

  const initials = (user?.username || user?.name || '?').toString().trim().charAt(0).toUpperCase();

  return (
    <div className={`avatar avatar-gradient rounded-full flex items-center justify-center ${sizes[size] || sizes.md}`}
         title={user?.username || user?.name || ''}>
      {initials}
    </div>
  );
}
