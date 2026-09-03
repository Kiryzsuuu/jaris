import mongoose, { Schema, models, model } from "mongoose";

export interface IRole {
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default (models.Role as mongoose.Model<IRole>) || model<IRole>("Role", RoleSchema);
