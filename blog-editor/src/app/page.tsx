import PostList from '@/components/PostList';

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-sans text-3xl text-[#FAFAFA] mb-2">Posts</h1>
        <p className="text-sm text-[#555555] font-mono">
          Manage your blog posts. Changes are saved directly to content/posts/.
        </p>
      </div>
      <PostList />
    </div>
  );
}
