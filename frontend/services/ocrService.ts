import * as ImageManipulator from "expo-image-manipulator";
import { parseReceipt, ParsedReceiptResult } from "./receiptParser";

export interface OcrScanResult {
  processedUri: string;
  rawText: string;
  parsed: ParsedReceiptResult;
  durationMs: number;
}

const MAX_IMAGE_WIDTH = 1280;

const extractTextFromMlKitResult = (result: any): string => {
  if (!result) {
    return "";
  }

  if (typeof result === "string") {
    return result;
  }

  if (typeof result.text === "string") {
    return result.text;
  }

  if (Array.isArray(result.blocks)) {
    return result.blocks
      .map((block: any) => {
        if (typeof block?.text === "string") {
          return block.text;
        }
        if (Array.isArray(block?.lines)) {
          return block.lines.map((line: any) => line?.text || "").join("\n");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
};

const preprocessImage = async (uri: string): Promise<string> => {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_WIDTH } }],
    {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );

  return manipulated.uri;
};

const runMlKitTextRecognition = async (uri: string): Promise<string> => {
  // Dynamic require keeps startup resilient if native module is temporarily unavailable.
  const mlkitModule = require("@react-native-ml-kit/text-recognition");
  const TextRecognition = mlkitModule.default ?? mlkitModule;
  const result = await TextRecognition.recognize(uri);
  return extractTextFromMlKitResult(result).trim();
};

export const scanReceiptWithMlKit = async (sourceUri: string): Promise<OcrScanResult> => {
  const startedAt = Date.now();
  const processedUri = await preprocessImage(sourceUri);
  const rawText = await runMlKitTextRecognition(processedUri);
  const parsed = parseReceipt(rawText);

  return {
    processedUri,
    rawText,
    parsed,
    durationMs: Date.now() - startedAt,
  };
};
