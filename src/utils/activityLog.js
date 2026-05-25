import { addDoc, collection } from "firebase/firestore";

export const ACTIVITY_LOGS_COLLECTION = "portal_activity_logs";

export const getCurrentSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

export const logActivity = async (db, payload) => {
  try {
    const actor = getCurrentSessionUser();
    await addDoc(collection(db, ACTIVITY_LOGS_COLLECTION), {
      actorEmail: payload.actorEmail || actor?.email || "",
      actorName: payload.actorName || actor?.name || actor?.email || "",
      actorRole: payload.actorRole || actor?.role || "",
      actorCompanyKey: payload.actorCompanyKey || actor?.companyKey || "",
      action: payload.action || "unknown_action",
      module: payload.module || "general",
      summary: payload.summary || "",
      targetId: payload.targetId || "",
      targetType: payload.targetType || "",
      metadata: payload.metadata || {},
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
};
