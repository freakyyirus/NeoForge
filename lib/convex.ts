const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

export const convex = {
  url: convexUrl,
};

export function useConvex() {
  return convex;
}
