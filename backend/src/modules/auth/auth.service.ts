import { conflict, unauthorized } from "../../utils/errors";
import { hashPassword, verifyPassword } from "../../utils/password";
import {
  createUser,
  findUserByEmail,
  getPublicUserById,
  toPublicUser,
  type PublicUser,
} from "../users/users.service";

export type { PublicUser };

/**
 * Auth orchestration: credentials in, public user out. All user table access is
 * delegated to the users module; this file only handles hashing, verification,
 * and the register/login rules.
 */
export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  if (findUserByEmail(input.email)) throw conflict("Email already registered");

  const passwordHash = await hashPassword(input.password);
  const user = createUser({ name: input.name, email: input.email, passwordHash });
  return toPublicUser(user);
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<PublicUser> {
  const user = findUserByEmail(input.email);
  if (!user) throw unauthorized("Invalid email or password");

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid email or password");

  return toPublicUser(user);
}

export function getUserById(id: number): PublicUser | undefined {
  return getPublicUserById(id);
}
