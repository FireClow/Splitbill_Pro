type AssignmentMap = Record<string, number>;

type AssignmentEntry = {
  userId?: string;
  user_id?: string;
  participantId?: string;
  participant_id?: string;
  quantity?: number;
};

type ItemWithAssignments = {
  quantity?: number;
  assigned_to?: string[];
  assignedTo?: string[];
  assigned_quantities?: Record<string, number>;
  assignedQuantities?: Record<string, number>;
  assignments?: AssignmentEntry[];
};

const toPositiveInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(parsed));
};

export const getAssignedTotal = (assignments: AssignmentMap): number => {
  return Object.values(assignments).reduce((sum, qty) => sum + toPositiveInt(qty), 0);
};

export const getSafeItemQuantity = (quantity: unknown): number => {
  return Math.max(toPositiveInt(quantity), 1);
};

export const normalizeAssignmentMap = (assignments?: Record<string, number>): AssignmentMap => {
  if (!assignments) {
    return {};
  }

  const normalized: AssignmentMap = {};
  Object.entries(assignments).forEach(([participantId, qty]) => {
    const parsedQty = toPositiveInt(qty);
    if (parsedQty > 0) {
      normalized[participantId] = parsedQty;
    }
  });

  return normalized;
};

export const getNormalizedItemAssignments = (item: ItemWithAssignments): AssignmentMap => {
  const fromMap = normalizeAssignmentMap(item.assigned_quantities || item.assignedQuantities);
  if (Object.keys(fromMap).length > 0) {
    return fromMap;
  }

  const fromAssignments = item.assignments || [];
  if (Array.isArray(fromAssignments) && fromAssignments.length > 0) {
    const fromList: AssignmentMap = {};
    fromAssignments.forEach((entry) => {
      const participantId = entry?.userId || entry?.user_id || entry?.participantId || entry?.participant_id;
      const qty = toPositiveInt(entry?.quantity);
      if (participantId && qty > 0) {
        fromList[participantId] = qty;
      }
    });
    if (Object.keys(fromList).length > 0) {
      return fromList;
    }
  }

  const assignedTo = item.assigned_to || item.assignedTo || [];
  const quantity = toPositiveInt(item.quantity);

  if (assignedTo.length === 1 && quantity > 0) {
    return { [assignedTo[0]]: quantity };
  }

  if (assignedTo.length === quantity && quantity > 0) {
    const inferred: AssignmentMap = {};
    assignedTo.forEach((participantId) => {
      inferred[participantId] = (inferred[participantId] || 0) + 1;
    });
    return inferred;
  }

  return {};
};

export const applyClampedAssignment = (
  assignments: AssignmentMap,
  participantId: string,
  requestedQty: number,
  itemQuantity: number
): { nextAssignments: AssignmentMap; maxAllowed: number; nextQty: number; wasClamped: boolean } => {
  const currentQty = toPositiveInt(assignments[participantId] || 0);
  const assignedWithoutCurrent = getAssignedTotal(assignments) - currentQty;
  const maxAllowed = Math.max(0, itemQuantity - assignedWithoutCurrent);
  const nextQty = Math.max(0, Math.min(toPositiveInt(requestedQty), maxAllowed));

  const nextAssignments: AssignmentMap = { ...assignments };
  if (nextQty === 0) {
    delete nextAssignments[participantId];
  } else {
    nextAssignments[participantId] = nextQty;
  }

  return {
    nextAssignments,
    maxAllowed,
    nextQty,
    wasClamped: toPositiveInt(requestedQty) > maxAllowed,
  };
};

export const mapAssignmentsToApiList = (assignments: AssignmentMap): { userId: string; quantity: number }[] => {
  return Object.entries(assignments).map(([userId, quantity]) => ({
    userId,
    quantity: toPositiveInt(quantity),
  }));
};
