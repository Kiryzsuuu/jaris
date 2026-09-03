import bcrypt from "bcryptjs";
import User from "@/models/User";
import Role from "@/models/Role";

const SALT_ROUNDS = 10;

export class UserServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  roleId: string;
  branch?: string;
}) {
  const name = params.name?.trim();
  const email = params.email?.trim().toLowerCase();
  const password = params.password;
  const roleId = params.roleId;
  const branch = params.branch?.trim() || "Kantor Pusat";

  if (!name || !email || !password || !roleId) {
    throw new UserServiceError("Nama, email, password, dan roleId wajib diisi", 400);
  }
  if (password.length < 8) {
    throw new UserServiceError("Password minimal 8 karakter", 400);
  }

  const role = await Role.findById(roleId);
  if (!role) {
    throw new UserServiceError("Role tidak ditemukan", 400);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new UserServiceError("Email sudah terdaftar", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email,
    passwordHash,
    roleId: role._id,
    branch,
    isActive: true,
  });

  return { user, role };
}

export function serializeUser(user: InstanceType<typeof User>, role?: InstanceType<typeof Role> | null) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    branch: user.branch,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.get("createdAt"),
    role: role
      ? { id: role._id.toString(), name: role.name, slug: role.slug }
      : { id: user.roleId?.toString() ?? null },
  };
}
