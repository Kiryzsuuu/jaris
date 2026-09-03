import type { HydratedDocument } from "mongoose";
import type { IAccidentPoint } from "@/models/AccidentPoint";

export function serializeAccidentPoint(point: HydratedDocument<IAccidentPoint>) {
  return {
    id: point._id.toString(),
    lat: point.location.coordinates[1],
    lng: point.location.coordinates[0],
    branch: point.branch,
    province: point.province,
    city: point.city,
    accidentDate: point.accidentDate,
    severity: point.severity,
    vehicleType: point.vehicleType,
    casualtyCount: point.casualtyCount,
    description: point.description,
    source: point.source,
  };
}
