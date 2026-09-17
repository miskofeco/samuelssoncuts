"use client";

import { CookieIcon, Logout03Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { useConsent } from "@/components/consent/consent-provider";
import { Avatar } from "@/components/shared/avatar";
import { Icon } from "@/components/shared/icon";
import { Logo, LogoMark } from "@/components/shared/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useT } from "@/i18n/provider";
import type { AuthProfile } from "@/server/auth";
import { cn } from "@/lib/classnames";

import { ProfileBadges } from "./account-panel";
import { badgeFor, formatBadge, isNavActive, type NavCounts, type NavSection } from "./nav-items";

/**
 * Desktop navigation (md and up). Collapses to an icon rail with tooltips;
 * state persists in the `sidebar_state` cookie via SidebarProvider.
 * On phones the shell renders MobileNav instead; this component's mobile
 * branch (a Sheet) is never opened.
 */
export function AppSidebar({
  sections,
  profile,
  counts,
}: {
  sections: NavSection[];
  profile: AuthProfile;
  counts: NavCounts;
}) {
  const pathname = usePathname();
  const t = useT();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <UiSidebar collapsible="icon" className="border-r-0 [&_[data-slot=sidebar-inner]]:border-r">
      {/* Same height as the desktop utility header so the two borders line up. */}
      <SidebarHeader className="h-14 justify-center border-b px-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Link
          href="/dashboard"
          className="flex h-10 items-center rounded-lg px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          aria-label="Samuelsson Cuts"
        >
          {collapsed ? <LogoMark className="size-8" priority /> : <Logo className="h-8" priority />}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, index) => (
          <SidebarGroup key={section.headingKey ?? index}>
            {section.headingKey ? (
              <SidebarGroupLabel className="text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
                {t.nav[section.headingKey]}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const count = badgeFor(item, counts);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={t.nav[item.key]}
                        className={cn(
                          // Expanded: 40px rows. Collapsed (icon rail): shadcn's 32px
                          // square; the label is removed so nothing peeks past the rail.
                          "relative h-10 rounded-lg px-3 font-medium text-sidebar-foreground/80",
                          // Icon rail: 40px squares centred in the 4rem rail, label removed.
                          "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span:last-child]:hidden",
                          "data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground",
                          "[&_svg]:size-[18px]",
                        )}
                      >
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <Icon icon={item.icon} strokeWidth={active ? 2 : 1.8} />
                          {count > 0 ? (
                            // Icon rail: the numeric badge is hidden by the primitive, so a
                            // dot on the icon's corner says "something is waiting here".
                            // Placed before the label so the label stays `span:last-child`.
                            <span
                              aria-hidden
                              className={cn(
                                "absolute top-1.5 right-1.5 hidden size-2 rounded-full bg-destructive ring-2 group-data-[collapsible=icon]:block",
                                active ? "ring-primary" : "ring-sidebar",
                              )}
                            />
                          ) : null}
                          <span>{t.nav[item.key]}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count > 0 ? (
                        <SidebarMenuBadge
                          className={cn(
                            // `top-1/2!` beats the primitive's size-variant offsets so the
                            // pill is vertically centred in the 40px row.
                            "top-1/2! right-3 h-5 min-w-5 -translate-y-1/2 rounded-full bg-destructive px-1.5 text-[0.65rem] font-bold",
                            // The primitive recolours the badge text on button hover/active
                            // (`peer-hover…:text-sidebar-accent-foreground`); pin ours through
                            // the same variants so the number stays legible on the red pill.
                            active
                              ? "bg-primary-foreground text-primary peer-hover/menu-button:text-primary peer-data-active/menu-button:text-primary"
                              : "text-white peer-hover/menu-button:text-white",
                          )}
                        >
                          {formatBadge(count)}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <AccountMenu profile={profile} collapsed={collapsed} />
      </SidebarFooter>
      <SidebarRail />
    </UiSidebar>
  );
}

function AccountMenu({ profile, collapsed }: { profile: AuthProfile; collapsed: boolean }) {
  const t = useT();
  const { openPreferences } = useConsent();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.nav.accountMenu}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none transition hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent",
            collapsed && "justify-center p-0",
          )}
        >
          <Avatar name={profile.full_name} src={profile.avatar_url} size={collapsed ? "md" : "sm"} />
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{profile.full_name}</span>
                <span className="block truncate text-xs text-muted-foreground">{profile.email}</span>
              </span>
              <Icon icon={MoreHorizontalIcon} className="text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar name={profile.full_name} src={profile.avatar_url} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{profile.full_name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{profile.email}</span>
          </span>
        </DropdownMenuLabel>
        <div className="px-2 pb-2">
          <ProfileBadges profile={profile} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openPreferences}>
          <Icon icon={CookieIcon} />
          {t.nav.cookiePreferences}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <Icon icon={Logout03Icon} />
              {t.common.signOut}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
