import { z } from "zod";

/** POST /api/claims request body — either pasted document text or an uploaded image/PDF (base64), not both required but at least one. */
export const ClaimSubmissionSchema = z
  .object({
    member_id: z.string().min(1),
    member_name: z.string().min(1),
    member_join_date: z.string().optional(),
    treatment_date: z.string().min(1),
    claim_amount: z.number().int().positive(),
    hospital: z.string().optional(),
    cashless_request: z.boolean().optional(),
    document_text: z.string().min(1).optional(),
    document_file_base64: z.string().min(1).optional(),
    document_file_mime: z.string().min(1).optional(),
  })
  .refine((data) => !!data.document_text || !!data.document_file_base64, {
    message: "Either document_text or a document_file_base64 upload is required",
  })
  .refine((data) => !data.document_file_base64 || !!data.document_file_mime, {
    message: "document_file_mime is required alongside document_file_base64",
  });

export type ClaimSubmission = z.infer<typeof ClaimSubmissionSchema>;
