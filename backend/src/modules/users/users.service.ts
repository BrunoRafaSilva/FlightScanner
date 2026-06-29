import { eq } from "drizzle-orm";
import { db } from "../../database/db";
import { users, type User } from "../../database/schema";

/**
 * User data access + public shaping. This module owns everything that reads or
 * writes the `users` table, so the auth module focuses purely on credentials
 * (hashing, verification, token issuing) and the rest of the app has one place
 * to fetch user records.
 */

/** A user safe to return over the API — never includes the password hash. */
export type PublicUser = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

export function toPublicUser(row: User): PublicUser {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt };
}

/** Full row (incl. password hash) — for internal auth use only. */
export function findUserByEmail(email: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .get();
}

export function findUserById(id: number): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** Public view of a user by id, or undefined if they no longer exist. */
export function getPublicUserById(id: number): PublicUser | undefined {
  const user = findUserById(id);
  return user ? toPublicUser(user) : undefined;
}

export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): User {
  return db
    .insert(users)
    .values({
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
    })
    .returning()
    .get();
}
