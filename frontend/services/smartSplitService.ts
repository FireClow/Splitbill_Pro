export type SmartSplitMethod = 'equal' | 'per_item';

export interface SmartSplitItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
}

export interface SmartSplitParticipant {
  id: string;
  name: string;
}

export interface SmartSplitResult {
  method: SmartSplitMethod;
  suggestion: Record<string, number>;
  reasoning: string;
  itemAssignments: Record<string, Record<string, number>>;
}

interface GenerateSmartSplitInput {
  items: SmartSplitItem[];
  participants: SmartSplitParticipant[];
  total?: number;
}

const roundMoney = (value: number): number => {
  return Number(value.toFixed(2));
};

export const generateSmartSplit = ({ items, participants, total = 0 }: GenerateSmartSplitInput): SmartSplitResult => {
  const safeParticipants = participants.filter((participant) => participant.id && participant.name);
  const suggestion: Record<string, number> = {};
  const itemAssignments: Record<string, Record<string, number>> = {};

  safeParticipants.forEach((participant) => {
    suggestion[participant.id] = 0;
  });

  if (safeParticipants.length === 0) {
    return {
      method: 'equal',
      suggestion: {},
      reasoning: 'Belum ada peserta. Tambahin peserta dulu ya 🙌',
      itemAssignments: {},
    };
  }

  if (!Array.isArray(items) || items.length === 0) {
    const equalShare = safeParticipants.length > 0 ? roundMoney(total / safeParticipants.length) : 0;
    safeParticipants.forEach((participant, index) => {
      suggestion[participant.id] = index === safeParticipants.length - 1
        ? roundMoney(total - equalShare * (safeParticipants.length - 1))
        : equalShare;
    });

    return {
      method: 'equal',
      suggestion,
      reasoning: 'Item kurang jelas, jadi kita bagi rata ya 🙏',
      itemAssignments: {},
    };
  }

  // Round-robin item assignment so each participant gets a fair starting suggestion.
  items.forEach((item, itemIndex) => {
    const quantity = Math.max(1, Number.isFinite(item.quantity) ? item.quantity : 1);
    const unitPrice = Number.isFinite(item.price) ? item.price : 0;
    const itemKey = item.id || `${item.name}-${itemIndex}`;

    itemAssignments[itemKey] = {};

    for (let q = 0; q < quantity; q += 1) {
      const targetParticipant = safeParticipants[(itemIndex + q) % safeParticipants.length];
      itemAssignments[itemKey][targetParticipant.id] = (itemAssignments[itemKey][targetParticipant.id] || 0) + 1;
      suggestion[targetParticipant.id] += unitPrice;
    }
  });

  Object.keys(suggestion).forEach((participantId) => {
    suggestion[participantId] = roundMoney(suggestion[participantId]);
  });

  return {
    method: 'per_item',
    suggestion,
    reasoning: 'Karena item berhasil terbaca dari struk, kami sarankan split per item.',
    itemAssignments,
  };
};
