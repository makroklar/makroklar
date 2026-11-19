import { ConciergeBell, FileText, ShieldCheck, Weight } from 'lucide-react';
import type { TaskId } from '../../data/dashboardModel';

const icons = {
  'import-pruefen': FileText,
  'basis-abwiegen': Weight,
  'gerichte-einrichten': ConciergeBell,
  'lmiv-freigabe': ShieldCheck,
} satisfies Record<TaskId, unknown>;

export function TaskIcon({ task, size = 20 }: { task: TaskId; size?: number }) {
  const Icon = icons[task];
  return <Icon aria-hidden="true" size={size} strokeWidth={1.75} />;
}
