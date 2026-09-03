import type { AccessTokenPayload } from "@/lib/auth";
import { ROLE_SLUGS } from "@/lib/permissions";

/**
 * Petugas Lapangan only ever see/act on claims they created.
 * Verifikator/Kepala Cabang, Direksi, and Super Admin see all claims
 * (Direksi is read-only because it lacks claim:verify / claim:approve).
 */
export function canViewAllClaims(session: AccessTokenPayload): boolean {
  return session.roleSlug !== ROLE_SLUGS.PETUGAS_LAPANGAN;
}

export function canAccessClaim(
  session: AccessTokenPayload,
  claimReporterId: string
): boolean {
  if (canViewAllClaims(session)) return true;
  return session.sub === claimReporterId;
}
