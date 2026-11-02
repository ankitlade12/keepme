import { NextResponse } from "next/server";

// Old open tabs receive a clear retirement message; no retailer request is made.
export function POST() {
  return NextResponse.json(
    {
      error:
        "Link import has been removed. Paste the product details and add photos to check an item.",
    },
    { status: 410 },
  );
}
