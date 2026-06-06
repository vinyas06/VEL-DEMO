import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

const safeName = (value = "") =>
  String(value || "attachment")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

export const uploadAttachments = async (files = [], folder = "general", recordKey = "record") => {
  const validFiles = Array.from(files).filter(Boolean);
  if (validFiles.length === 0) {
    return [];
  }

  const timestamp = Date.now();

  return Promise.all(
    validFiles.map(async (file, index) => {
      const name = safeName(file.name || `attachment-${index + 1}`);
      const path = `attachments/${safeName(folder)}/${safeName(recordKey)}/${timestamp}-${index + 1}-${name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
      });
      const url = await getDownloadURL(storageRef);

      return {
        name: file.name || name,
        url,
        path,
        type: file.type || "",
        size: file.size || 0,
        uploadedAt: new Date().toISOString(),
      };
    })
  );
};
