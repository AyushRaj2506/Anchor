export function getDisplayName(user) {
  if (!user) return "User";
  if (user.isDemo) return "Demo User";
  if (user.email) {
    const prefix = user.email.split('@')[0];
    const firstPart = prefix.split('.')[0];
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
  }
  return user.name || "User";
}
