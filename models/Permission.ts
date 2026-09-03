import mongoose, { Schema, models, model } from "mongoose";

export interface IPermission {
  key: string;
  description: string;
}

const PermissionSchema = new Schema<IPermission>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

export default (models.Permission as mongoose.Model<IPermission>) ||
  model<IPermission>("Permission", PermissionSchema);
