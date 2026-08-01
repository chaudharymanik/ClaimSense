import roster from "@/data/member_roster.json";

const MEMBER_IDS = new Set(roster.members.map((m) => m.member_id.toUpperCase()));

/** Simulated employee roster check — see data/member_roster.json's _comment for why this exists. */
export function isMemberOnRoster(memberId: string): boolean {
  return MEMBER_IDS.has(memberId.trim().toUpperCase());
}
