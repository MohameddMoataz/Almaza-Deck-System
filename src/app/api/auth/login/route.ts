import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { username } });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    return NextResponse.redirect(new URL("/login?error=Invalid%20username%20or%20password.", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(`/users/${user.username}`, request.url), 303);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    createSessionToken({ userId: user.id, username: user.username, role: user.role as "USER" | "ADMIN" }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    }
  );
  return response;
}
