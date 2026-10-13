// Layout values remain semantic; A/B are presentation labels, never data IDs.
export const SEMESTER_LAYOUT_KEY = "semester-layout-v2";
export function useFocusLayout(saved: string | null) { return saved !== "full"; }

// Seven Sydney calendar dates including today, independent of DST day length.
export function inNextSevenDays(date: string | undefined, today: string) {
  if (!date || date < today) return false;
  const days = (Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400000;
  return days >= 0 && days < 7;
}
