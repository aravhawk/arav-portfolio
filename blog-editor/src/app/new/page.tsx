import PostForm from '@/components/PostForm';

export default function NewPostPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-sans text-3xl text-[#FAFAFA] mb-2">New Post</h1>
        <p className="text-sm text-[#555555] font-mono">
          Create a new blog post. The MDX file will be saved to content/posts/.
        </p>
      </div>
      <PostForm mode="create" />
    </div>
  );
}
