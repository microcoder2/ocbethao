import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { isLocalIdentityProvider, normalizeProvider } from "./authProviders";

export class IdentityError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export type AuthIdentityInput = {
  provider: string;
  providerUserId: string;
  providerEmail?: string | null;
  providerPhone?: string | null;
  providerUsername?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  rawProfile?: Prisma.InputJsonValue;
};

function cleanNullable(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

export function normalizeProviderUserId(provider: string, providerUserId: string): string {
  const normalizedProvider = normalizeProvider(provider);
  const rawValue = String(providerUserId || "").trim();

  if (!rawValue) {
    return "";
  }

  if (normalizedProvider === "email") {
    return rawValue.toLowerCase();
  }

  if (normalizedProvider === "phone") {
    return rawValue.replace(/\s+/g, "");
  }

  return rawValue;
}

function buildIdentityData(input: AuthIdentityInput) {
  const provider = normalizeProvider(input.provider);
  const providerUserId = normalizeProviderUserId(provider, input.providerUserId);

  if (!provider || !providerUserId) {
    throw new IdentityError(400, "provider and providerUserId are required");
  }

  if (isLocalIdentityProvider(provider)) {
    throw new IdentityError(
      400,
      "Local identifiers belong on the User record, not UserAuthIdentity",
      "LOCAL_IDENTITY_NOT_SUPPORTED"
    );
  }

  return {
    provider,
    providerUserId,
    providerEmail: cleanNullable(input.providerEmail),
    providerPhone: cleanNullable(input.providerPhone),
    providerUsername: cleanNullable(input.providerUsername),
    displayName: cleanNullable(input.displayName),
    avatarUrl: cleanNullable(input.avatarUrl),
    emailVerified: Boolean(input.emailVerified),
    phoneVerified: Boolean(input.phoneVerified),
    rawProfile: input.rawProfile ?? undefined,
  };
}

export async function upsertAuthIdentityForUser(
  userId: number,
  input: AuthIdentityInput
) {
  const data = buildIdentityData(input);
  const existing = await prisma.userAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: data.provider,
        providerUserId: data.providerUserId,
      },
    },
  });

  if (existing && existing.userId !== userId) {
    throw new IdentityError(409, "Auth identity already linked to another user", "IDENTITY_TAKEN");
  }

  if (existing) {
    return prisma.userAuthIdentity.update({
      where: { id: existing.id },
      data: {
        ...data,
        revokedAt: null,
      },
    });
  }

  return prisma.userAuthIdentity.create({
    data: {
      userId,
      ...data,
    },
  });
}

export async function deleteLocalAuthIdentitiesForUser(userId: number): Promise<void> {
  await prisma.userAuthIdentity.deleteMany({
    where: {
      userId,
      provider: {
        in: ["username", "phone", "email"],
      },
    },
  });
}

export async function deleteAllLocalAuthIdentities(): Promise<void> {
  await prisma.userAuthIdentity.deleteMany({
    where: {
      provider: {
        in: ["username", "phone", "email"],
      },
    },
  });
}

export async function replaceExternalAuthIdentities(
  userId: number,
  identities: AuthIdentityInput[]
): Promise<void> {
  const normalizedInputs = identities
    .map((identity) => buildIdentityData(identity))
    .filter((identity) => !isLocalIdentityProvider(identity.provider));

  for (const identity of normalizedInputs) {
    await upsertAuthIdentityForUser(userId, identity);
  }

  const keepKeys = new Set(
    normalizedInputs.map((identity) => `${identity.provider}:${identity.providerUserId}`)
  );

  const current = await prisma.userAuthIdentity.findMany({
    where: { userId },
  });

  const staleExternalIds = current
    .filter((identity) => !isLocalIdentityProvider(identity.provider))
    .filter((identity) => !keepKeys.has(`${identity.provider}:${identity.providerUserId}`))
    .map((identity) => identity.id);

  if (staleExternalIds.length > 0) {
    await prisma.userAuthIdentity.deleteMany({
      where: {
        id: { in: staleExternalIds },
      },
    });
  }
}

export async function deleteAuthIdentityForUser(
  userId: number,
  provider: string,
  identityId: number
): Promise<void> {
  const normalizedProvider = normalizeProvider(provider);
  const identity = await prisma.userAuthIdentity.findFirst({
    where: {
      id: identityId,
      userId,
      provider: normalizedProvider,
    },
  });

  if (!identity) {
    throw new IdentityError(404, "Auth identity not found", "IDENTITY_NOT_FOUND");
  }

  await prisma.userAuthIdentity.delete({
    where: { id: identity.id },
  });
}

export async function findUserByVerifiedContact(input: {
  email?: string | null;
  phone?: string | null;
}) {
  const email = cleanNullable(input.email)?.toLowerCase() || null;
  const phone = cleanNullable(input.phone) || null;

  if (!email && !phone) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    include: {
      authIdentities: {
        where: { revokedAt: null },
      },
    },
  });
}
