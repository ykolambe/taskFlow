/** Next approver in a sequential chain, or null when every step is approved. */
export function getNextRequiredApprover(
  approverChain: string[],
  existingApprovals: { approverId: string; status: string }[]
): string | null {
  const approvedIds = new Set(
    existingApprovals
      .filter((a) => a.status === "APPROVED")
      .map((a) => a.approverId)
  );
  return approverChain.find((uid) => !approvedIds.has(uid)) ?? null;
}
