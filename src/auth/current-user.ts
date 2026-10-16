export type AppRole = "USER" | "RESPONSIBLE" | "ADMIN";

export type CurrentUser = { id: string; displayName: string; role: AppRole };

export { getCurrentUser } from "./request-user";

export function canManagePeople(user: CurrentUser) { return user.role === "ADMIN"; }

export function canCreateTraining(user: CurrentUser) {
  return user.role === "USER" || user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canEditTraining(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canCreateSession(user: CurrentUser) {
  return user.role === "USER" || user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canEditSession(user: CurrentUser, status: "PENDING" | "EXECUTED" | "NOT_EXECUTED") {
  void status;
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canCloseSession(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canReopenSession(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canCloseTraining(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canGenerateAnnexIII(user: CurrentUser) {
  return user.role === "USER" || user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canReadAnnualPlan(user: CurrentUser) {
  return user.role === "USER" || user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canGenerateAnnexIV(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canReadPersonHistory(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canGenerateAnnexV(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canReadDocumentControl(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canReadTrainerDocuments(user: CurrentUser) {
  return user.role === "ADMIN";
}

export function canUpdateDocumentControl(user: CurrentUser) {
  return user.role === "RESPONSIBLE" || user.role === "ADMIN";
}

export function canAccessAdministration(user: CurrentUser) {
  return user.role === "ADMIN";
}
