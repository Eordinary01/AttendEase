/**
 * Direct code-based branch matcher.
 * Subject.branch stores the branch CODE (e.g. "CSE", "AIML", "ME").
 * Filters compare codes directly — no fuzzy/alias/substring logic.
 *
 * @param {string} subjectBranch - Branch code stored on the subject
 * @param {string} targetBranch  - Branch code selected as filter
 * @param {Array}  _courses      - Unused (kept for call-site compat)
 * @param {Object} [options]     - { excludeUnassigned: false }
 */
export const isBranchMatch = (subjectBranch, targetBranch, _courses = [], options = {}) => {
  const normTarget = String(targetBranch || "").trim().toLowerCase();
  const normSubject = String(subjectBranch || "").trim().toLowerCase();

  if (!normTarget || normTarget === "all" || normTarget === "all branches") {
    return true;
  }

  if (!normSubject) {
    return !options.excludeUnassigned;
  }

  return normSubject === normTarget;
};

/**
 * Checks if targetBranch code exists in branchList
 */
export const isBranchInList = (targetBranch, branchList = []) => {
  if (!targetBranch) return true;
  if (!Array.isArray(branchList) || branchList.length === 0) return true;
  const norm = String(targetBranch).trim().toLowerCase();
  return branchList.some((b) => String(b).trim().toLowerCase() === norm);
};
