import { NextResponse } from "next/server";

export function successResponse<T>(data: T, message = "OK", status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

export function errorResponse(message: string, status = 500, data: unknown = null) {
  return NextResponse.json(
    {
      success: false,
      data,
      message,
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  console.error(error);
  const message = error instanceof Error ? error.message : "Internal server error";
  return errorResponse(message, 500);
}
