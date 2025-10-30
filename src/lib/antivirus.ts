import { Buffer } from "node:buffer";
/**
 * Antivirus protection utilities for uploads.
 * Provides validation, scanning and quarantine storage helpers.
 */

import { NextRequest } from "next/server";
import { getAdminSupabase } from "./supabase/admin";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "application/json"
];

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  ".mp4", ".webm", ".mov",
  ".pdf", ".txt", ".json"
];

const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /system\s*\(/gi,
  /shell_exec\s*\(/gi,
  /base64_decode/gi,
  /file_get_contents/gi,
  /fopen\s*\(/gi,
  /fwrite\s*\(/gi,
  /include\s*\(/gi,
  /require\s*\(/gi
];

const SQL_PATTERNS = [
  /union\s+select/gi,
  /drop\s+table/gi,
  /delete\s+from/gi,
  /insert\s+into/gi,
  /update\s+set/gi,
  /or\s+1\s*=\s*1/gi,
  /and\s+1\s*=\s*1/gi
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
}

export function validateFileExtension(filename: string): boolean {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.includes(extension);
}

export function validateFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

export async function scanFileContent(content: string | Buffer): Promise<{ safe: boolean; threats: string[] }>
{
  const threats: string[] = [];
  const value = content instanceof Buffer ? content.toString("utf8") : String(content);

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(value)) {
      threats.push(`Dangerous pattern detected: ${pattern.source}`);
    }
  }

  const malwareSignatures = [
    "eval(",
    "exec(",
    "system(",
    "shell_exec(",
    "base64_decode(",
    "file_get_contents(",
    "fopen(",
    "fwrite(",
    "include(",
    "require(",
    "<script",
    "javascript:",
    "vbscript:",
    "onload=",
    "onerror=",
    "onclick="
  ];

  for (const signature of malwareSignatures) {
    if (value.toLowerCase().includes(signature.toLowerCase())) {
      threats.push(`Malware signature detected: ${signature}`);
    }
  }

  for (const pattern of SQL_PATTERNS) {
    if (pattern.test(value)) {
      threats.push(`SQL injection attempt detected: ${pattern.source}`);
    }
  }

  return {
    safe: threats.length === 0,
    threats
  };
}

export async function validateUploadedFile(file: File, content?: string | Buffer): Promise<{ valid: boolean; errors: string[]; warnings: string[] }>
{
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!validateMimeType(file.type)) {
    errors.push(`Unsupported MIME type: ${file.type}`);
  }

  if (!validateFileExtension(file.name)) {
    errors.push(`Unsupported file extension: ${file.name}`);
  }

  if (!validateFileSize(file.size)) {
    errors.push(`File too large: ${file.size} bytes (max ${MAX_FILE_SIZE})`);
  }

  if (content) {
    const scanResult = await scanFileContent(content);
    if (!scanResult.safe) {
      errors.push(...scanResult.threats);
    }
  }

  if (file.name.includes("..")) {
    errors.push("Suspicious file name detected");
  }

  if (file.name.length > 255) {
    errors.push("File name is too long");
  }

  if (file.type.startsWith("text/") && file.size > 1024 * 1024) {
    warnings.push("Large text file detected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function withAntivirusProtection(handler: (request: NextRequest) => Promise<Response>) {
  return async function protectedHandler(request: NextRequest): Promise<Response> {
    try {
      const contentType = request.headers.get("content-type");
      if (contentType && contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        for (const [, value] of (formData as any).entries()) {
          if (value instanceof File) {
            const validation = await validateUploadedFile(value);
            if (!validation.valid) {
              return new Response(
                JSON.stringify({
                  error: "File rejected by antivirus rules",
                  details: validation.errors,
                  warnings: validation.warnings,
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
            if (validation.warnings.length > 0) {
              console.warn(`Antivirus warnings for ${value.name}:`, validation.warnings);
            }
          }
        }
      }
      return await handler(request);
    } catch (error) {
      console.error("Antivirus middleware error:", error);
      return new Response(
        JSON.stringify({
          error: "File validation error",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  };
}

export function getAntivirusConfig() {
  return {
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    allowedExtensions: ALLOWED_EXTENSIONS,
    maxFileSize: MAX_FILE_SIZE,
    dangerousPatternsCount: DANGEROUS_PATTERNS.length,
  };
}

export async function scanFile(file: File): Promise<{ clean: boolean; threats: string[] }>
{
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await scanFileContent(buffer);
  return {
    clean: result.safe,
    threats: result.threats,
  };
}

export function sanitizeFileName(name: string): string {
  const fallback = "upload.bin";
  if (!name) {
    return fallback;
  }
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
  return normalized || fallback;
}

export interface StoreFileOptions {
  userId?: string;
  destinationBucket: string;
  destinationPath: string;
  makePublic?: boolean;
}

export interface StoreFileResult {
  status: "approved" | "rejected";
  quarantineId: string;
  quarantinePath: string;
  path?: string;
  publicUrl?: string | null;
  threats?: string[];
}

export async function storeFileWithQuarantine(file: File, options: StoreFileOptions): Promise<StoreFileResult> {
  const supabase = getAdminSupabase();
  const safeName = sanitizeFileName(file.name);
  const scanResult = await scanFile(file);

  const baseId = options.userId ? `${options.userId}_${Date.now()}` : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const quarantineId = baseId;
  const quarantinePath = `${quarantineId}/${safeName}`;

  const quarantineUpload = await supabase.storage
    .from("quarantine")
    .upload(quarantinePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (quarantineUpload.error) {
    throw new Error(`Failed to store file in quarantine: ${quarantineUpload.error.message}`);
  }

  if (!scanResult.clean) {
    return {
      status: "rejected",
      quarantineId,
      quarantinePath,
      threats: scanResult.threats,
    };
  }

  const destinationUpload = await supabase.storage
    .from(options.destinationBucket)
    .upload(options.destinationPath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (destinationUpload.error) {
    throw new Error(`Failed to upload file to destination bucket: ${destinationUpload.error.message}`);
  }

  let publicUrl: string | null = null;
  if (options.makePublic) {
    const { data: publicData } = supabase.storage
      .from(options.destinationBucket)
      .getPublicUrl(options.destinationPath);
    publicUrl = publicData.publicUrl;
  }

  return {
    status: "approved",
    quarantineId,
    quarantinePath,
    path: options.destinationPath,
    publicUrl,
    threats: [],
  };
}

export async function getQuarantineStatus(quarantineId: string): Promise<{ status: "quarantined" | "approved" | "rejected"; publicUrl?: string }>
{
  try {
    const supabase = getAdminSupabase();
    const { data: files } = await supabase.storage
      .from("quarantine")
      .list(quarantineId);

    if (!files || files.length === 0) {
      return { status: "rejected" };
    }

    return { status: "quarantined" };
  } catch (error) {
    console.error("Error while checking quarantine status:", error);
    return { status: "rejected" };
  }
}

export async function cleanupQuarantine(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<{ cleaned: number; errors: string[] }>
{
  const supabase = getAdminSupabase();
  const errors: string[] = [];
  let cleaned = 0;

  try {
    const { data: objects, error } = await supabase.storage
      .from("quarantine")
      .list("", { limit: 1000 });

    if (error) {
      errors.push(`Failed to list quarantine objects: ${error.message}`);
      return { cleaned, errors };
    }

    const now = Date.now();
    for (const entry of objects || []) {
      if (entry.name && now - new Date(entry.created_at).getTime() > maxAgeMs) {
        const { error: deleteError } = await supabase.storage
          .from("quarantine")
          .remove([entry.name]);
        if (deleteError) {
          errors.push(`Failed to remove ${entry.name}: ${deleteError.message}`);
        } else {
          cleaned++;
        }
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown cleanup error");
  }

  return { cleaned, errors };
}
