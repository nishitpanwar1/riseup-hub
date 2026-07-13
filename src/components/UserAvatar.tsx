type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  alt?: string;
  className?: string;
};

export function UserAvatar({ src, name, alt, className = "w-9 h-9" }: UserAvatarProps) {
  const label = (name || "U").slice(0, 2).toUpperCase();
  return (
    <div className={`${className} rounded-full bg-bg-surface border border-rise flex items-center justify-center font-bold text-xs overflow-hidden shrink-0`}>
      {src ? (
        <img src={src} alt={alt ?? name ?? "avatar"} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        label
      )}
    </div>
  );
}