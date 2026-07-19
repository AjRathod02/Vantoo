import { createClient } from "@/utils/supabase/server";
import { createAnonClient } from "@/utils/supabase/anon";
import { createAdminClient, hasAdminClient } from "@/utils/supabase/admin";
import { cookies, headers } from "next/headers";
import type { User } from "@/lib/types";

type ProfileRow = {
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
};

async function fetchProfileById(userId: string): Promise<ProfileRow | null> {
  if (hasAdminClient()) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("profiles")
        .select("name, phone, email, role")
        .eq("id", userId)
        .maybeSingle<ProfileRow>();
      if (data) return data;
    } catch {
      // fall through
    }
  }
  return null;
}

async function fetchProfile(
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<ProfileRow | null> {
  const fromAdmin = await fetchProfileById(userId);
  if (fromAdmin) return fromAdmin;

  const { data, error } = await supabase
    .from("profiles")
    .select("name, phone, email, role")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error?.message?.includes("schema cache")) return null;
  return data;
}

function mapUser(
  authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  profile?: ProfileRow | null
): User {
  const meta = authUser.user_metadata ?? {};
  return {
    id: authUser.id,
    name:
      profile?.name ||
      (typeof meta.name === "string" ? meta.name : undefined) ||
      "Vantoo User",
    phone:
      profile?.phone ||
      (typeof meta.phone === "string" ? meta.phone : undefined) ||
      "",
    email: profile?.email || authUser.email || undefined,
    role: profile?.role === "admin" ? "admin" : "customer",
  };
}

async function getUserFromBearer(): Promise<User | null> {
  const headerStore = await headers();
  const auth = headerStore.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.slice("Bearer ".length).trim();
  if (!token || token.length < 20) return null;

  try {
    const supabase = createAnonClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const profile = await fetchProfileById(user.id);
    return mapUser(user, profile);
  } catch {
    return null;
  }
}

async function getUserFromCookies(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const profile = await fetchProfile(user.id, supabase);
    return mapUser(user, profile);
  } catch {
    return null;
  }
}

/**
 * Resolves the current user from:
 * 1) Authorization: Bearer <supabase_access_token> (mobile / native)
 * 2) Supabase session cookies (web)
 */
export async function getSessionUser(): Promise<User | null> {
  const fromBearer = await getUserFromBearer();
  if (fromBearer) return fromBearer;
  return getUserFromCookies();
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin() {
  try {
    const { requireAdminAuth } = await import("@/lib/admin/auth");
    const ctx = await requireAdminAuth();
    return {
      id: ctx.admin.id,
      name: ctx.admin.name,
      phone: ctx.admin.phone ?? "",
      email: ctx.admin.email,
      role: "admin" as const,
      adminRole: ctx.admin.role,
      permissions: ctx.permissions,
      sessionId: ctx.sessionId,
    };
  } catch {
    const user = await requireUser();
    if (user.role !== "admin") throw new Error("Forbidden");
    return user;
  }
}
