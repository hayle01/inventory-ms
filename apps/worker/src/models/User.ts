import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * Minimal, read-only projection of the `users` collection owned by the API
 * app's identity module -- the worker never writes to it. Only the fields
 * notification rendering actually needs are declared; `strict: false` lets
 * the document round-trip through Mongoose without every field from the
 * API's full schema being duplicated here.
 */
const notificationUserSchema = new Schema(
  {
    fullName: { type: String, required: true },
    emailNormalized: { type: String, required: true },
  },
  { collection: 'users', strict: false },
);

export type NotificationUserDoc = InferSchemaType<typeof notificationUserSchema> & {
  _id: unknown;
};

export const NotificationUserModel: Model<NotificationUserDoc> = model<NotificationUserDoc>(
  'NotificationUser',
  notificationUserSchema,
);
