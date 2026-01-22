"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface Video {
  id: string
  title: string
  url: string
  description: string
}

export default function YouTubePage() {
  const [videos, setVideos] = useState<Video[]>([
    {
      id: "1",
      title: "Sample Video 1",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "A sample YouTube video"
    }
  ])
  const [newVideo, setNewVideo] = useState({ title: "", url: "", description: "" })
  const [isOpen, setIsOpen] = useState(false)

  const addVideo = () => {
    if (newVideo.title && newVideo.url) {
      setVideos([...videos, { ...newVideo, id: Date.now().toString() }])
      setNewVideo({ title: "", url: "", description: "" })
      setIsOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">YouTube Management</h1>
          <p className="text-muted-foreground">
            Manage your YouTube videos and content.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Add Video</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Video</DialogTitle>
              <DialogDescription>
                Enter the details for your new YouTube video.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Video Title"
                value={newVideo.title}
                onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
              />
              <Input
                placeholder="YouTube URL"
                value={newVideo.url}
                onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={newVideo.description}
                onChange={(e) => setNewVideo({ ...newVideo, description: e.target.value })}
              />
              <Button onClick={addVideo} className="w-full">Add Video</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <Card key={video.id}>
            <CardHeader>
              <CardTitle>{video.title}</CardTitle>
              <CardDescription>{video.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Watch Video
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}