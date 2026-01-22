"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface Post {
  id: string
  title: string
  content: string
  author: string
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([
    {
      id: "1",
      title: "Sample Blog Post",
      content: "This is a sample blog post content.",
      author: "Admin"
    }
  ])
  const [newPost, setNewPost] = useState({ title: "", content: "", author: "Admin" })
  const [isOpen, setIsOpen] = useState(false)

  const addPost = () => {
    if (newPost.title && newPost.content) {
      setPosts([...posts, { ...newPost, id: Date.now().toString() }])
      setNewPost({ title: "", content: "", author: "Admin" })
      setIsOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog Management</h1>
          <p className="text-muted-foreground">
            Create and manage your blog posts.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Add Post</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Post</DialogTitle>
              <DialogDescription>
                Write your new blog post.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Post Title"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              />
              <Textarea
                placeholder="Post Content"
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                rows={6}
              />
              <Input
                placeholder="Author"
                value={newPost.author}
                onChange={(e) => setNewPost({ ...newPost, author: e.target.value })}
              />
              <Button onClick={addPost} className="w-full">Add Post</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <CardTitle>{post.title}</CardTitle>
              <CardDescription>By {post.author}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{post.content.substring(0, 100)}...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}