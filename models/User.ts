import mongoose, { Schema, models, model, Types } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  roleId: Types.ObjectId;
  isActive: boolean;
  branch: string;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    isActive: { type: Boolean, default: true },
    // Wilayah/cabang penempatan pegawai - dipakai untuk agregasi dashboard per wilayah.
    branch: { type: String, required: true, trim: true, default: "Kantor Pusat" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export default (models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);
