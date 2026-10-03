import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

function cleanUsername(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = cleanUsername(form.get("username"));
  const password = String(form.get("password") ?? "");

  if (username.length < 3 || password.length < 6) {
    return NextResponse.redirect(new URL("/signup?error=Username%20or%20password%20is%20too%20short.", request.url), 303);
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(password)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.redirect(new URL("/signup?error=That%20username%20is%20already%20taken.", request.url), 303);
    }

    return NextResponse.redirect(new URL("/signup?error=Could%20not%20create%20account.", request.url), 303);
  }

  const response = NextResponse.redirect(new URL(`/users/${user.username}?tab=CARDS#import-sets`, request.url), 303);
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
