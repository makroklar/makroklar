import { TaskOverviewPage } from '@/areas/business/TaskOverviewPage';

export default async function Page({ params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  return <TaskOverviewPage taskId={task} />;
}
