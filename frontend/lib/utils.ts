import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { networkInterfaces } from "os";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function nestPort(): string {
  return process.env.NEXT_PUBLIC_NEST_WS_PORT || "5000";
}

export function getApiUrl(): string {
  const pub = process.env.NEXT_PUBLIC_NEST_API_URL?.trim();

  if (pub?.startsWith("/")) {
    return pub.replace(/\/$/, "") || "/api";
  }

  if (typeof window !== "undefined") {
    if (pub) return pub.replace(/\/$/, "");
    return `${window.location.protocol}//${window.location.hostname}:${nestPort()}/api`;
  }

  if (pub) return pub.replace(/\/$/, "");

  return `https://127.0.0.1:${nestPort()}/api`;
}

export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:${nestPort()}/ws`;
  }
  const nest = (process.env.NEST_URL || "https://127.0.0.1:5000").replace(
    /\/$/,
    "",
  );
  return `${nest.replace(/^http/, "ws")}/ws`;
}

const VIRTUAL_ADAPTER_NAMES =
  /WSL|vEthernet|Docker|Hyper-V|VirtualBox|VMware|Loopback/i;

export function getLanIp(): string | null {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    if (VIRTUAL_ADAPTER_NAMES.test(name)) continue;
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (
        iface.family === "IPv4" &&
        !iface.internal &&
        (iface.address.startsWith("192.168.") ||
          iface.address.startsWith("10."))
      ) {
        return iface.address;
      }
    }
  }
  return null;
}
