const SID_EMAIL_DOMAIN = "auth.studycrm.app";

export const normalizeSid = (input: string): string => input.trim();

export const isValidSid = (input: string): boolean => {
  const sid = normalizeSid(input);
  return /^[0-9]{9}$/.test(sid);
};

export const sidToEmail = (sid: string): string => {
  const normalized = normalizeSid(sid);
  return `${normalized}@${SID_EMAIL_DOMAIN}`;
};

export const isStrongPassword = (password: string): boolean => {
  if (password.length < 10) {
    return false;
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  return hasUpper && hasLower && hasNumber && hasSymbol;
};

export const userToSid = (email: string | null | undefined, metadataSid?: string): string => {
  if (metadataSid && isValidSid(metadataSid)) {
    return normalizeSid(metadataSid);
  }

  if (!email) {
    return "---------";
  }

  const [localPart] = email.split("@");
  return isValidSid(localPart) ? localPart : "---------";
};
