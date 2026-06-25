import { formatRelativeTime } from "@repo/shared-utils/format";

interface RelativeTimeCellProps {
  date: string;
}

export function RelativeTimeCell({ date }: RelativeTimeCellProps) {
  return <span>{formatRelativeTime(date)}</span>;
}
