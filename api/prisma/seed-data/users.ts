import { CustomerType, Role } from "@prisma/client";

export type SeedUserKey =
  | "admin"
  | "staffMai"
  | "staffKhanh"
  | "lanAnh"
  | "quocPhuc"
  | "minhChau"
  | "anNhi";

export type SeedUserProfile = {
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  role: Role;
  customerType?: CustomerType;
  preferredAuthProvider: string;
};

export const seedUserProfiles: Record<SeedUserKey, SeedUserProfile> = {
  admin: {
    fullName: "Quản trị viên Ốc Bé Thảo",
    username: "admin",
    email: "admin@ocbethao.local",
    phone: "0909000001",
    role: Role.ADMIN,
    preferredAuthProvider: "email",
  },
  staffMai: {
    fullName: "Nguyễn Thị Mai",
    username: "mai.phucvu",
    email: "mai@ocbethao.local",
    phone: "0909000002",
    role: Role.STAFF,
    preferredAuthProvider: "email",
  },
  staffKhanh: {
    fullName: "Trần Khánh Duy",
    username: "khanh.bep",
    email: "khanh@ocbethao.local",
    phone: "0909000004",
    role: Role.STAFF,
    preferredAuthProvider: "email",
  },
  lanAnh: {
    fullName: "Lê Lan Anh",
    username: "lananh",
    email: "lananh@ocbethao.local",
    phone: "0909000003",
    role: Role.CUSTOMER,
    customerType: CustomerType.REGULAR,
    preferredAuthProvider: "phone",
  },
  quocPhuc: {
    fullName: "Phạm Quốc Phúc",
    username: "quocphuc",
    email: "quocphuc@ocbethao.local",
    phone: "0909000005",
    role: Role.CUSTOMER,
    customerType: CustomerType.VIP,
    preferredAuthProvider: "phone",
  },
  minhChau: {
    fullName: "Trịnh Minh Châu",
    username: "minhchau",
    email: "minhchau@ocbethao.local",
    phone: "0909000006",
    role: Role.CUSTOMER,
    customerType: CustomerType.OFFICE,
    preferredAuthProvider: "email",
  },
  anNhi: {
    fullName: "Đỗ An Nhi",
    username: "annhi",
    email: "annhi@ocbethao.local",
    phone: "0909000007",
    role: Role.CUSTOMER,
    customerType: CustomerType.TOURIST,
    preferredAuthProvider: "google",
  },
};
