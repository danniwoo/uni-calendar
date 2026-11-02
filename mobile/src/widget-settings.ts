import type { SampleBoard } from "./model";

export type WidgetSettings = {
  version: 1;
  units: string[] | null; // null follows all units, including any added later.
  showTitles: boolean;
};
export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  version: 1,
  units: null,
  showTitles: true,
};
export function readWidgetSettings(
  raw: string | null,
  board: SampleBoard,
): WidgetSettings {
  if (!raw) return DEFAULT_WIDGET_SETTINGS;
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      typeof value.showTitles !== "boolean" ||
      (value.units !== null && !Array.isArray(value.units))
    )
      return DEFAULT_WIDGET_SETTINGS;
    const known = new Set(board.assessments.map((a) => a.unit));
    return {
      version: 1,
      showTitles: value.showTitles,
      units:
        value.units === null
          ? null
          : [
              ...new Set<string>(
                value.units.filter(
                  (u: unknown): u is string =>
                    typeof u === "string" && known.has(u),
                ),
              ),
            ].sort(),
    };
  } catch {
    return DEFAULT_WIDGET_SETTINGS;
  }
}
export function widgetBoard(
  board: SampleBoard,
  settings: WidgetSettings,
): SampleBoard {
  return {
    ...board,
    assessments: board.assessments.filter(
      (a) => settings.units === null || settings.units.includes(a.unit),
    ),
  };
}
export function toggleWidgetUnit(
  settings: WidgetSettings,
  unit: string,
  allUnits: string[],
): WidgetSettings {
  const selected = settings.units ?? allUnits;
  const units = (
    selected.includes(unit)
      ? selected.filter((u) => u !== unit)
      : [...selected, unit]
  ).sort();
  return {
    ...settings,
    units: units.length === allUnits.length ? null : units,
  };
}
