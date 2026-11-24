import { ConciergeBell, FileText, ShieldCheck } from 'lucide-react';
import { IconWeightKg } from '@/shared/components/icons/IconWeightKg';
import type { TaskId } from '../../data/dashboardModel';

const icons = {
  'import-pruefen': FileText,
  'basis-abwiegen': IconWeightKg,
  'gerichte-einrichten': ConciergeBell,
  'lmiv-freigabe': ShieldCheck,
} satisfies Record<TaskId, unknown>;

export function TaskIcon({ task, size = 20 }: { task: TaskId; size?: number }) {
  const Icon = icons[task];
  return <Icon aria-hidden="true" size={size} strokeWidth={1.75} />;
}
