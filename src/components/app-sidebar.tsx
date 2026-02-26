"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  LayoutDashboard,
  Settings2,
  Youtube,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin",
    email: "admin@librosa.io",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "librosa Studio",
      logo: AudioWaveform,
      plan: "Audio Analysis",
    },
  ],
  navMain: [
    {
      title: "Audio Analysis",
      url: "/admin/analyze",
      icon: AudioWaveform,
      isActive: true,
    },
    {
      title: "Dashboard",
      url: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: "YouTube",
      url: "/admin/youtube",
      icon: Youtube,
    },
    {
      title: "Blog",
      url: "/admin/blog",
      icon: BookOpen,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings2,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}