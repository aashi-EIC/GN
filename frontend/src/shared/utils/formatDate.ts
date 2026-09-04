export function formatRelativeDate(dateValue: string) {
  const date = new Date(dateValue);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))}m ago`;
  }
  if (diff < day) {
    return `${Math.round(diff / hour)}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
