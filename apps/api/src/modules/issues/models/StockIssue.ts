import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { MAX_STOCK_ISSUE_LINES, STOCK_ISSUE_STATUSES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const stockIssueItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    stockRequestLineNumber: { type: Number, default: null },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    lotNumber: { type: String, default: null },
    pickedQuantity: { type: Schema.Types.Decimal128, required: true },
    returnedQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    unitCost: { type: Schema.Types.Decimal128, default: null },
  },
  { _id: false },
);

const stockIssueSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    issueNumber: { type: String, required: true },
    stockRequestId: { type: Schema.Types.ObjectId, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: STOCK_ISSUE_STATUSES, default: 'draft' },
    items: {
      type: [stockIssueItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_STOCK_ISSUE_LINES,
        message: `Stock issues must have between 1 and ${String(MAX_STOCK_ISSUE_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    /** Set only on a reversal issue; points back at the issue it undoes. */
    reversalOfId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    pickedBy: { type: Schema.Types.ObjectId, default: null },
    pickedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, default: null },
    postedAt: { type: Date, default: null },
    /** Stamped on the *original* posted issue once a reversal exists for it; the original is otherwise never edited. */
    reversedBy: { type: Schema.Types.ObjectId, default: null },
    reversedAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'stockIssues' },
);

stockIssueSchema.index({ organizationId: 1, issueNumber: 1 }, { unique: true });
stockIssueSchema.index({ organizationId: 1, status: 1 });
stockIssueSchema.index({ organizationId: 1, stockRequestId: 1 });
stockIssueSchema.index({ organizationId: 1, reversalOfId: 1 });

export type StockIssueDoc = InferSchemaType<typeof stockIssueSchema> & { _id: Types.ObjectId };

export const StockIssueModel: Model<StockIssueDoc> = model<StockIssueDoc>(
  'StockIssue',
  stockIssueSchema,
);

registerModel('StockIssue', StockIssueModel);
