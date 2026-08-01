import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function MockGoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  }),
  Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
}));

const { extractFromText } = await import("@/lib/llm/extraction");

beforeEach(() => {
  generateContentMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("LLM extraction layer — error handling (Rules.md: never crash, route to MANUAL_REVIEW instead)", () => {
  it("maps a valid schema-conforming response to ClaimDocuments", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        prescription: {
          doctor_name: "Dr. X",
          doctor_reg: "KA/11111/2015",
          diagnosis: "Cold",
          medicines_prescribed: null,
          procedures: null,
          treatment: null,
          tests_prescribed: null,
        },
        bill_items: [{ key: "consultation_fee", label: "Consultation Fee", amount: 500 }],
        test_names: null,
        medical_necessity: { necessary: true, reasoning: "ok" },
        extraction_confidence: 0.9,
        notes: null,
      }),
    });

    const result = await extractFromText("some document text");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.documents.prescription?.doctor_reg).toBe("KA/11111/2015");
    expect(result.documents.bill?.consultation_fee).toBe(500);
    expect(result.confidence).toBe(0.9);
  });

  it("tolerates omitted nullable fields instead of failing (Gemini sometimes drops them)", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ extraction_confidence: 0.8 }),
    });

    const result = await extractFromText("sparse document");
    expect(result.success).toBe(true);
  });

  it("fails gracefully on invalid JSON", async () => {
    generateContentMock.mockResolvedValue({ text: "not valid json{" });
    const result = await extractFromText("x");
    expect(result.success).toBe(false);
  });

  it("fails gracefully when the response violates the schema (wrong type)", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ extraction_confidence: "high" }),
    });
    const result = await extractFromText("x");
    expect(result.success).toBe(false);
  });

  it("fails gracefully when the API call throws", async () => {
    generateContentMock.mockRejectedValue(new Error("network down"));
    const result = await extractFromText("x");
    expect(result.success).toBe(false);
  });

  it("fails gracefully when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await extractFromText("x");
    expect(result.success).toBe(false);
  });
});
