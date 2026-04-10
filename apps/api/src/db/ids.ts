import { Types } from "mongoose";
import { HttpError } from "../utils/http-error.js";

export function toIdString(value: Types.ObjectId | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toString();
}

export function toObjectId(value: string, errorCode: string, message: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new HttpError(404, errorCode, message);
  }

  return new Types.ObjectId(value);
}

export function toOptionalObjectId(value: string | null | undefined): Types.ObjectId | null {
  if (!value) {
    return null;
  }

  return new Types.ObjectId(value);
}
