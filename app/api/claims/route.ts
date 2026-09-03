import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { successResponse, errorResponse, handleApiError } from "@/lib/apiResponse";
import { requirePermission, authErrorResponse, AuthError } from "@/lib/authGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { canViewAllClaims } from "@/lib/claimAccess";
import { CASE_CATEGORIES, CLAIM_STATUSES, TRANSPORT_MODES } from "@/lib/claimTypes";
import { generateClaimNumber } from "@/lib/claimNumber";
import { serializeClaim } from "@/lib/claimSerializer";
import { recordAuditLog } from "@/lib/auditLog";
import Claim from "@/models/Claim";
import Claimant from "@/models/Claimant";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_VIEW);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const branch = searchParams.get("branch");

    const query: Record<string, unknown> = {};
    if (status) {
      if (!CLAIM_STATUSES.includes(status as (typeof CLAIM_STATUSES)[number])) {
        return errorResponse(`Status tidak dikenal: ${status}`, 400);
      }
      query.status = status;
    }
    if (branch) {
      query.branch = branch;
    }
    if (!canViewAllClaims(session)) {
      query.reporterId = session.sub;
    }

    const claims = await Claim.find(query).sort({ createdAt: -1 }).limit(200);
    const claimantIds = [...new Set(claims.map((c) => c.claimantId.toString()))];
    const claimants = await Claimant.find({ _id: { $in: claimantIds } });
    const claimantMap = new Map(claimants.map((c) => [c._id.toString(), c]));

    const data = claims.map((c) => serializeClaim(c, claimantMap.get(c.claimantId.toString())));

    return successResponse(data, "Daftar klaim");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const session = requirePermission(request, PERMISSIONS.CLAIM_CREATE);

    const body = await request.json();

    const requiredFields = [
      "accidentDate",
      "accidentLocation",
      "accidentDescription",
      "transportMode",
      "caseCategory",
      "claimant",
    ];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === "") {
        return errorResponse(`Field '${field}' wajib diisi`, 400);
      }
    }

    if (!TRANSPORT_MODES.includes(body.transportMode)) {
      return errorResponse(`transportMode tidak valid: ${body.transportMode}`, 400);
    }
    if (!CASE_CATEGORIES.includes(body.caseCategory)) {
      return errorResponse(`caseCategory tidak valid: ${body.caseCategory}`, 400);
    }
    if (body.caseCategory === "cacat_tetap" && typeof body.disabilityPercentage !== "number") {
      return errorResponse(
        "disabilityPercentage (angka) wajib diisi untuk kategori cacat_tetap",
        400
      );
    }
    if (body.caseCategory === "perawatan" && typeof body.claimedTreatmentCost !== "number") {
      return errorResponse(
        "claimedTreatmentCost (angka) wajib diisi untuk kategori perawatan",
        400
      );
    }

    const claimantInput = body.claimant ?? {};
    if (!claimantInput.fullName || !claimantInput.nik || !claimantInput.relationshipToVictim) {
      return errorResponse(
        "Data claimant (fullName, nik, relationshipToVictim) wajib diisi",
        400
      );
    }

    const claimant = await Claimant.create({
      fullName: claimantInput.fullName,
      nik: claimantInput.nik,
      relationshipToVictim: claimantInput.relationshipToVictim,
      phone: claimantInput.phone,
      address: claimantInput.address,
      bankName: claimantInput.bankName,
      bankAccountNumber: claimantInput.bankAccountNumber,
      bankAccountHolder: claimantInput.bankAccountHolder,
    });

    const claimNumber = await generateClaimNumber();
    const reporter = await User.findById(session.sub);

    const claim = await Claim.create({
      claimNumber,
      reporterId: session.sub,
      branch: reporter?.branch ?? "Kantor Pusat",
      claimantId: claimant._id,
      accidentDate: new Date(body.accidentDate),
      accidentLocation: body.accidentLocation,
      accidentDescription: body.accidentDescription,
      transportMode: body.transportMode,
      caseCategory: body.caseCategory,
      disabilityPercentage: body.disabilityPercentage ?? null,
      claimedTreatmentCost: body.claimedTreatmentCost ?? null,
      status: "draft",
      documents: [],
      estimatedAmount: null,
      approvedAmount: null,
    });

    await recordAuditLog({
      actorId: session.sub,
      actorEmail: session.email,
      action: "claim_created",
      target: "claim",
      targetId: claim._id,
      after: { claimNumber: claim.claimNumber, status: claim.status },
    });

    return successResponse(serializeClaim(claim, claimant), "Draft klaim berhasil dibuat", 201);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return handleApiError(error);
  }
}
