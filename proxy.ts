import { NextResponse } from "next/server";

const ADS_TXT = "google.com, pub-5004421599745939, DIRECT, f08c47fec0942fa0\n";

export function proxy() {
  return new NextResponse(ADS_TXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

export const config = {
  matcher: "/ads.txt",
};
