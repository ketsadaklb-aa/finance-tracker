import { cookies } from "next/headers";
import { prisma } from "./db";

export const SESSION_COOKIE = "ft_session";
export const SESSION_DURATION_DAYS = 30;

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.isBlocked) return null;

  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

// Returns account IDs visible to this user.
// Admins see all accounts; members only see granted ones.
export async function getVisibleAccountIds(userId: string, role: string): Promise<string[] | null> {
  if (role === "admin") return null; // null = no filter, see all

  const access = await prisma.accountAccess.findMany({
    where: { userId },
    select: { accountId: true },
  });
  return access.map((a) => a.accountId);
}
