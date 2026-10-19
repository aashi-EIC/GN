export function firstName(name: string) {
  return name.split(" ")[0] || "there";
}

export function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "NI";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
