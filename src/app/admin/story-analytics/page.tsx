// src/app/admin/story-analytics/page.tsx
import AdminStoryAnalyticsDashboard from '@/components/AdminStoryAnalyticsDashboard';

export default function AdminStoryAnalyticsPage() {
  return (
    <div>
      <AdminStoryAnalyticsDashboard />
    </div>
  );
}

export const metadata = {
  title: 'Admin Story Analytics - EchoStone',
  description: 'Administrative dashboard for story usage monitoring and analytics',
};