/** 노트 안의 기도제목 하나. 제목과 상세 중 하나 이상을 가진다(불변식). */
export interface PrayerItemContent {
  title: string | null;
  detail: string | null;
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim() === "";
}

export function hasPrayerItemContent(item: PrayerItemContent): boolean {
  return !isBlank(item.title) || !isBlank(item.detail);
}

/** 제목이 비어 있으면 상세의 첫 줄을 제목처럼 보여 준다. */
export function displayTitle(item: PrayerItemContent): string {
  if (!isBlank(item.title)) {
    return item.title!.trim();
  }
  const firstLine = item.detail?.trim().split("\n")[0] ?? "";
  return firstLine.trim();
}
