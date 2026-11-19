import { TaskItemPage } from '@/areas/business/TaskItemPage';

export default async function Page({ params }: { params: Promise<{ task: string; item: string }> }) {
  const { task, item } = await params;
  return <TaskItemPage taskId={task} slug={item} />;
}
