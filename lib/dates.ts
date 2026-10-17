const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD"가 실제로 존재하는 날짜인지 검사 */
export function isValidDateStr(value: string): boolean {
  const match = value.match(DATE_RE);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** 오늘 날짜를 "YYYY-MM-DD"로 반환 */
export function todayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** "YYYY-MM-DD" → "YYYY.M.D" */
export function formatKoreanDate(dateStr: string): string {
  const match = dateStr.match(DATE_RE);
  if (!match) {
    return dateStr;
  }

  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

/** 시작일로부터 지난 일수. 당일이면 1일을 반환 (만난 지 N일 기준) */
export function daysSince(dateStr: string): number {
  const start = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

/** 날짜가 과거(오늘 이전)인지 */
export function isPastDate(dateStr: string): boolean {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return target.getTime() < today.getTime();
}
